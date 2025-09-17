import  express  from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(express.urlencoded({extended:true}));

app.get('/auth',(req,res)=>{
    res.status(200).json({
        success:true,
        message:"Welcome to authentication system"
    })
});

export default app;