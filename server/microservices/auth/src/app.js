import  express  from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRouter from "./routers/auth.router.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(express.urlencoded({extended:true}));

app.use('/api/auth',authRouter);

app.use(errorHandler);

export default app;