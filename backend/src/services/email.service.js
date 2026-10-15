/**
 * Email Dispatch Service
 * Handles transactional emails for RFQ revisions, approvals, and PO notifications.
 */
export const emailService = {
  async sendEmail({ to, subject, html, text }) {
    console.log('------------------------------------------------------------');
    console.log(`📧 [EMAIL NOTIFICATION] Dispatched to: ${to || 'vendor@example.com'}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Content: ${text || (html ? html.replace(/<[^>]+>/g, ' ').substring(0, 150) + '...' : '')}`);
    console.log('------------------------------------------------------------');
    return { success: true, messageId: `msg_${Date.now()}` };
  },

  async sendRevisionRequestEmail({ vendorEmail, vendorName, rfqNo, round, remarks, items }) {
    const subject = `RFQ-${rfqNo}: Revision requested`;
    const text = `Dear ${vendorName || 'Vendor'},\n\nDDPL Purchase Department has requested a rate revision for RFQ ${rfqNo} (Round ${round}).\n\nRemarks from Purchase Manager:\n${remarks || 'Please review the requested revised rates and submit your final response.'}\n\nPlease login to the DDPL Vendor Portal to review the proposed rates and either accept them or submit your final rates.\n\nThank you,\nDecent Decor Pvt. Ltd Procurement Team`;
    
    return this.sendEmail({
      to: vendorEmail,
      subject,
      text
    });
  },

  async sendRevisionSubmittedEmail({ managerEmail, vendorName, rfqNo, round, responseType, totalAmount }) {
    const subject = `RFQ-${rfqNo}: Revised bid submitted by ${vendorName}`;
    const text = `Dear Purchase Team,\n\nVendor "${vendorName}" has submitted their response to the rate revision request for RFQ ${rfqNo} (Round ${round}).\nResponse Type: ${responseType}\nFinal Revised Total: ₹${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n\nPlease check the RFQ details on the procurement portal to review the updated matrix and L1 rankings.\n\nThank you,\nDDPL Procurement Portal`;

    return this.sendEmail({
      to: managerEmail || 'purchase@decentdecorindia.com',
      subject,
      text
    });
  }
};

export default emailService;
