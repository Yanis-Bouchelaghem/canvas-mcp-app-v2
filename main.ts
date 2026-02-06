import { createServer } from "./server.js";
import cors from "cors";
import express from "express";

const port = parseInt(process.env.PORT ?? "3001", 10);
const app = express();
app.use(cors());

app.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
});