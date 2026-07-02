export const getDashboardRouteForRole = (role) => {
  if (!role) return '/login';
  
  switch (role.toUpperCase()) {
    case 'CUSTOMER':
      return '/customer/dashboard';
    case 'COURIER':
      return '/courier/dashboard';
    case 'INSPECTOR':
      return '/inspector/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/login';
  }
};
