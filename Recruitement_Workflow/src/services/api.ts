
import axios from "axios";
import { getToken } from "@/services/token.service";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  "http://192.168.1.128:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach the saved JWT to API requests.
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
