import 'dotenv/config'
import connectDB from './db/dbconfig.js';
import { app } from './app.js';





// (async ()=>{
//     try {
//        await mongoose.connect(`${process.env.MONGODB_URL}/${db_name}`);
//        app.on("error", (error)=>{
//         console.log("ERR: ", error);
//        })

//        app.listen(process.env.PORT, ()=>{
//         console.log(`App is listening on port ${process.env.PORT}`)
//        })
        
//     } catch (error) {
//         console.log('ERR: ',error)
//     }
// })()

connectDB()
.then(() => {
    app.on("error", (error)=>{
        console.log("ERR: ", error);
     });
        
    app.listen(process.env.PORT || 8000, () =>{
        console.log(`Listening on port: ${process.env.PORT}`)
    });
    // app.listen( PORT, () =>{
    //     console.log(`Listening on port: ${PORT}`)
    // });
    
}).catch((err) => {
    console.log('Database connection failed!!', err)
});