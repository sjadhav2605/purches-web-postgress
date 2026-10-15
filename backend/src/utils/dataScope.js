import pool from '../config/db.js';
import { ApiError } from './apiError.js';
import { ROLES } from '../constants/roles.js';

/**
 * Record-level data scoping for Deliveries / Purchase Orders / Vendor Billed Challans.
 *
 * Always based on the REAL account role (user.role from the verified token's DB row), never on the
 * admin "view as" simulation, so scoping cannot be bypassed from the client.
 *
 *  - admin / purchase / accounts : everything
 *  - director                    : records whose requisition OR rfq is routed to them (target_director_id)
 *  - supervisor / pc             : records of their assigned site (users.default_site_id)
 *  - vendor                      : records of their own vendor (users.vendor_id)
 *  - anything else / unassigned  : nothing (fail closed)
 */

// Column / expression mapping per query shape
export const PO_COLS = {
  siteCol: 'po.site_id',
  vendorCol: 'po.vendor_id',
  requisitionExpr: 'po.requisition_id',
  rfqExpr: 'po.rfq_id'
};
export const DELIVERY_COLS = { ...PO_COLS, siteCol: 'd.site_id' }; // deliveries d JOIN purchase_orders po
export const CHALLAN_COLS = {
  siteCol: 'vbc.site_id',
  vendorCol: 'vbc.vendor_id',
  requisitionExpr: 'COALESCE(vbc.requisition_id, po.requisition_id)',
  rfqExpr: 'po.rfq_id'
}; // vendor_billed_challans vbc LEFT JOIN purchase_orders po

// Existing director routing aliases: Director 1 = 5, Director 2 = 10 (legacy 6), Director 3 = 11 (legacy 7)
const directorSlot = (user) => {
  const uId = Number(user?.directorId || user?.id);
  const email = String(user?.email || '').toLowerCase();
  if (uId === 10 || uId === 6 || email.includes('director2')) return 2;
  if (uId === 11 || uId === 7 || email.includes('director3')) return 3;
  if (uId === 5 || email.includes('director1') || email === 'director@ddpl.com') return 1;
  return null;
};

export const resolveScope = (user) => {
  switch (user?.role) {
    case ROLES.ADMIN:
    case ROLES.PURCHASE:
    case ROLES.ACCOUNTS:
      return { type: 'all' };
    case ROLES.DIRECTOR:
      return { type: 'director', slot: directorSlot(user), userId: Number(user.id) };
    case ROLES.SUPERVISOR:
    case ROLES.PC:
      return user.default_site_id ? { type: 'site', siteId: Number(user.default_site_id) } : { type: 'none' };
    case ROLES.VENDOR:
      return user.vendor_id ? { type: 'vendor', vendorId: Number(user.vendor_id) } : { type: 'none' };
    default:
      return { type: 'none' };
  }
};

const directorCond = (alias, scope, params) => {
  const t = `${alias}.target_director_id`;
  const n = `LOWER(${alias}.target_director_name)`;
  if (scope.slot === 2) return `(${t} IN (10, 6) OR ${n} LIKE '%director 2%')`;
  if (scope.slot === 3) return `(${t} IN (11, 7) OR ${n} LIKE '%director 3%')`;
  if (scope.slot === 1) return `(${t} = 5 OR ${n} LIKE '%director 1%')`;
  params.push(scope.userId);
  return `${t} = ?`;
};

/**
 * Builds a parameterised SQL condition (without leading AND) for the given scope.
 * Returns { sql: null } when the user may see everything.
 */
export const buildScope = (scope, cols) => {
  const params = [];
  switch (scope.type) {
    case 'all':
      return { sql: null, params, type: scope.type };
    case 'vendor':
      params.push(scope.vendorId);
      return { sql: `${cols.vendorCol} = ?`, params, type: scope.type };
    case 'site':
      params.push(scope.siteId);
      return { sql: `${cols.siteCol} = ?`, params, type: scope.type };
    case 'director': {
      const reqCond = directorCond('rq', scope, params);
      const rfqCond = directorCond('rf', scope, params);
      return {
        sql: `(EXISTS (SELECT 1 FROM requisitions rq WHERE rq.id = ${cols.requisitionExpr} AND ${reqCond}) ` +
             `OR EXISTS (SELECT 1 FROM rfqs rf WHERE rf.id = ${cols.rfqExpr} AND ${rfqCond}))`,
        params,
        type: scope.type
      };
    }
    default:
      return { sql: '1 = 0', params, type: 'none' };
  }
};

/** Convenience: scope condition for a user + query shape */
export const scopeFor = (user, cols) => buildScope(resolveScope(user), cols);

/**
 * Throws 404 if the PO does not exist, 403 if it exists but is outside the user's scope.
 * Returns { id, site_id, vendor_id } of the PO.
 */
export const assertPoVisible = async (poId, user) => {
  const [exists] = await pool.query('SELECT id, site_id, vendor_id FROM purchase_orders WHERE id = ? LIMIT 1', [poId]);
  if (exists.length === 0) throw ApiError.notFound('Purchase Order not found');

  const { sql, params } = scopeFor(user, PO_COLS);
  if (sql) {
    const [rows] = await pool.query(
      `SELECT po.id FROM purchase_orders po WHERE po.id = ? AND ${sql} LIMIT 1`,
      [poId, ...params]
    );
    if (rows.length === 0) throw ApiError.forbidden('You do not have access to this Purchase Order');
  }
  return exists[0];
};

/** 404 if the challan does not exist, 403 if outside the user's scope. */
export const assertChallanVisible = async (challanId, user) => {
  const [exists] = await pool.query('SELECT id FROM vendor_billed_challans WHERE id = ? LIMIT 1', [challanId]);
  if (exists.length === 0) throw ApiError.notFound('Vendor billed challan not found');

  const { sql, params } = scopeFor(user, CHALLAN_COLS);
  if (sql) {
    const [rows] = await pool.query(
      `SELECT vbc.id
       FROM vendor_billed_challans vbc
       LEFT JOIN purchase_orders po ON vbc.po_id = po.id
       WHERE vbc.id = ? AND ${sql} LIMIT 1`,
      [challanId, ...params]
    );
    if (rows.length === 0) throw ApiError.forbidden('You do not have access to this billed challan');
  }
};
