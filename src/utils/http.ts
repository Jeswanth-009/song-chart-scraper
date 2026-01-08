import axios from "axios";
import { config } from "../config.js";

export const fetchHtml = async (url: string): Promise<string> => {
  const response = await axios.get<string>(url, {
    headers: { "User-Agent": config.userAgent },
    responseType: "text",
    timeout: 20000,
  });
  return response.data;
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
