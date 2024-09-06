import mongoose from "mongoose";
import { db_name } from "../constants.js";
const connectDB = async ()=>{
   
   try {
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${db_name}`);
    console.log(`\n MongoDB Connected Successfully!! DB HOST: ${connectionInstance.connection.host}`)
    } 
   catch (error) {
    console.log("Connection error!", error);
    process.exit(1);
   }
}

    export default connectDB;