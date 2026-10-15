import pool from '../../config/db.js';
import { PaymentModel } from './payment.model.js';

export const PaymentService = {
  async getAllPayments() {
    return await PaymentModel.findAll();
  },

  async getPoSummary() {
    return await PaymentModel.getPoSummary();
  },

  async getPaymentsByPo(poId) {
    return await PaymentModel.findByPoId(poId);
  },

  async recordPayment(payload, currentUser) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const paymentId = await PaymentModel.create({
        ...payload,
        recorded_by_id: currentUser.id
      });

      // Audit Log
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('Payment', ?, 'Payment Recorded', ?, ?, ?)`,
        [
          String(paymentId),
          currentUser.id,
          currentUser.name,
          `Payment of ₹${Number(payload.amount).toLocaleString()} recorded via ${payload.mode} (${payload.reference_no})`
        ]
      );

      await connection.commit();
      return { id: paymentId, message: 'Payment recorded successfully' };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }
};
