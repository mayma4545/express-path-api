const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ohseeevent@gmail.com',         // As requested by user
    pass: 'kzer phvd nuob vvfg'           // App password provided
  }
});

/**
 * Reusable function to send emails
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} [html] - HTML body (optional)
 * @returns {Promise<any>}
 */
const sendEmail = async (to, subject, text, html = null) => {
  try {
    const mailOptions = {
      from: '"OHSEE Events" <ohseeevent@gmail.com>',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text,
      ...(html && { html })
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = {
  transporter,
  sendEmail
};
