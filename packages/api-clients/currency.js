// Dummy currency conversion client
async function convertCurrency(from, to, amount) {
  // For now, just return the same amount for simplicity
  return Number(amount);
}

module.exports = { convertCurrency }; 