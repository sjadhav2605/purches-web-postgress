import pool from '../../config/db.js';

export const MastersModel = {
  // ===================== MATERIALS =====================
  async getMaterials(search = '', siteId = null, category = null) {
    let sql = 'SELECT * FROM materials WHERE active = 1';
    const params = [];
    if (siteId) {
      sql += ' AND (site_id = ? OR is_common = 1 OR site_id IS NULL)';
      params.push(siteId);
    }
    if (category && category.trim()) {
      sql += ' AND category = ?';
      params.push(category.trim());
    }
    if (search && search.trim()) {
      sql += ' AND (description LIKE ? OR category LIKE ? OR spec LIKE ?)';
      const p = `%${search.trim()}%`;
      params.push(p, p, p);
    }
    sql += ' ORDER BY description ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async createMaterial({ description, spec, unit, category, hsn, ref_rate, site_id, is_common }) {
    const [res] = await pool.query(
      `INSERT INTO materials (description, spec, unit, category, hsn, ref_rate, site_id, is_common) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [description, spec || null, unit, category, hsn || null, ref_rate || 0, site_id || null, is_common !== undefined ? (is_common ? 1 : 0) : 1]
    );
    return res.insertId;
  },

  async deleteMaterial(id) {
    const [res] = await pool.query('DELETE FROM materials WHERE id = ?', [id]);
    return res.affectedRows > 0;
  },

  // ===================== SITES =====================
  async getSites(search = '', currentUser = null) {
    let sql = `
      SELECT s.*,
             STRING_AGG(DISTINCT (CASE WHEN u.role = 'supervisor' THEN u.name END), ', ') AS assigned_supervisors,
             STRING_AGG(DISTINCT (CASE WHEN u.role = 'pc' THEN u.name END), ', ') AS assigned_pcs
      FROM sites s
      LEFT JOIN users u ON s.id = u.default_site_id
    `;
    const params = [];
    const where = [];

    // Role-based site restriction: Project Coordinator and Site Supervisor ONLY see their assigned site!
    const effectiveRole = currentUser?.activeRole || currentUser?.role;
    if (['supervisor', 'pc'].includes(effectiveRole) && currentUser?.default_site_id) {
      where.push('s.id = ?');
      params.push(currentUser.default_site_id);
    }

    if (search && search.trim()) {
      where.push('(s.name LIKE ? OR s.code LIKE ? OR s.address LIKE ?)');
      const p = `%${search.trim()}%`;
      params.push(p, p, p);
    }

    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }
    sql += ' GROUP BY s.id ORDER BY s.id DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async createSite({ code, name, address, gstin }) {
    const [res] = await pool.query(
      `INSERT INTO sites (code, name, address, gstin) 
       VALUES (?, ?, ?, ?)`,
      [code, name, address, gstin || null]
    );
    return res.insertId;
  },

  async deleteSite(id) {
    const [res] = await pool.query('DELETE FROM sites WHERE id = ?', [id]);
    return res.affectedRows > 0;
  },

  // ===================== VENDORS =====================
  async getVendors(search = '') {
    let sql = 'SELECT * FROM vendors';
    const params = [];
    if (search && search.trim()) {
      sql += ' WHERE name LIKE ? OR gstin LIKE ? OR phone LIKE ? OR city LIKE ? OR contact_person LIKE ? OR email LIKE ?';
      const p = `%${search.trim()}%`;
      params.push(p, p, p, p, p, p);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async createVendor(data) {
    const {
      name,
      constitution,
      gstin,
      gst_treatment,
      pan,
      email,
      phone,
      landline,
      address,
      city,
      state,
      pin,
      contact_person,
      designation,
      website,
      goods_services,
      brands,
      categories,
      advance_pct,
      credit_days,
      payment_terms_note,
      review_note,
      account_holder,
      bank_name,
      branch,
      account_no,
      account_type,
      ifsc,
      micr,
      year_established,
      years_in_business,
      employees,
      form_submitted,
      documents,
      active
    } = data;

    const [res] = await pool.query(
      `INSERT INTO vendors (
        name, constitution, gstin, gst_treatment, pan, email, phone, landline,
        address, city, state, pin, contact_person, designation, website,
        goods_services, brands, categories, advance_pct, credit_days,
        payment_terms_note, review_note, account_holder, bank_name, branch,
        account_no, account_type, ifsc, micr, year_established, years_in_business,
        employees, form_submitted, documents, active
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )`,
      [
        name,
        constitution || null,
        gstin || null,
        gst_treatment || null,
        pan || null,
        email || null,
        phone || null,
        landline || null,
        address || null,
        city || null,
        state || null,
        pin || null,
        contact_person || null,
        designation || null,
        website || null,
        goods_services || null,
        brands || null,
        typeof categories === 'string' ? categories : JSON.stringify(categories || []),
        advance_pct ? Number(advance_pct) : 0,
        credit_days ? Number(credit_days) : 30,
        payment_terms_note || null,
        review_note || null,
        account_holder || null,
        bank_name || null,
        branch || null,
        account_no || null,
        account_type || 'Current',
        ifsc || null,
        micr || null,
        year_established || null,
        years_in_business ? Number(years_in_business) : null,
        employees || null,
        form_submitted || 'Online Registration',
        typeof documents === 'string' ? documents : (documents ? JSON.stringify(documents) : null),
        active !== undefined ? (active ? 1 : 0) : 1
      ]
    );
    return res.insertId;
  },

  async deleteVendor(id) {
    const [res] = await pool.query('DELETE FROM vendors WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }
};
