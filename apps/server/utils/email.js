// Simple wrapper to maintain compatibility with modules requiring '../utils/email'
// Delegates to the main mailer utility

const mailer = require('./mailer');

module.exports = {
  sendEmail: mailer.sendEmail,
  sendTemplatedEmail: mailer.sendTemplatedEmail,
  loadTemplate: mailer.loadTemplate,
  // Re-export enhanced helpers if needed later
  ...mailer
};