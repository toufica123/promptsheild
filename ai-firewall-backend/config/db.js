const mongoose=require("mongoose");

const connectDB=async()=>{
    try{
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MONGODB CONNECTED`);
    }
    catch(error){
        console.error("MONGODB CONNECTION ERROR:", error.message);
        process.exit(1);
    }
}

module.exports=connectDB;
