import app from "./src/app.js";
import getConfig from "./src/config/config_keys.js";
import connectToDb from "./src/db/db.js";

connectToDb();

const port = getConfig('port');

app.listen(port,()=>{
    console.log(`Auth service is running on port ${port}`);
});
