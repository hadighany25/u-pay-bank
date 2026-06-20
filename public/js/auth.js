const getAuthHeaders = () => {
  const token = sessionStorage.getItem("userToken");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};
