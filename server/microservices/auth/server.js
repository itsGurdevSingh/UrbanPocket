import app from "./src/app.js";
import connectToDb from "./src/db/db.js";

connectToDb();

app.listen(4000,()=>{
    console.log("Server is running at port 4000");
});
