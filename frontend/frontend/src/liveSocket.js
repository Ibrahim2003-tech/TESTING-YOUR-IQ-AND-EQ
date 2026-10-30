import { io } from "socket.io-client";

export const connectLiveSocket = (url, options) => io(url, options);
