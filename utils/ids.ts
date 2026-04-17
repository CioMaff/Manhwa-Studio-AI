
export const generateId = (prefix: string = 'id'): string => {
  // Combine timestamp with random string to guarantee uniqueness even in rapid batch operations
  // This fixes the "Generating on top" bug caused by identical Date.now() values
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};
