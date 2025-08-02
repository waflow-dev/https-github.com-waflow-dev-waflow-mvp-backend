export const generateCustomId = async (model, prefix, field) => {
  const count = await model.countDocuments();
  const nextNumber = (count + 1).toString().padStart(4, "0");
  return `${prefix}-${nextNumber}`;
};
