/**
 * Calculates quote totals based on items and charges
 * @param {Array} items - Array of { itemId, quantity, price }
 * @param {Number} serviceCharge - Service charge amount
 * @param {Number} discount - Discount amount
 * @returns {Object} { subtotal, totalAmount }
 */
const calculateQuoteTotals = (items, serviceCharge = 0, discount = 0) => {
  const subtotal = items.reduce((acc, item) => {
    return acc + (parseFloat(item.price) * parseInt(item.quantity));
  }, 0);

  const totalAmount = (subtotal + parseFloat(serviceCharge)) - parseFloat(discount);

  return {
    subtotal: subtotal.toFixed(2),
    totalAmount: Math.max(0, totalAmount).toFixed(2)
  };
};

module.exports = { calculateQuoteTotals };
