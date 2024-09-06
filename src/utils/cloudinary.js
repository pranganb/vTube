import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

 // Configuration
 cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const cloudinaryFileUpload = async (pathToFile)=>{
    try {
        if(!pathToFile) return null
           const response = await cloudinary.uploader.upload(pathToFile, {resource_type: 'auto'});
           console.log("File Uploaded Successfully!!")
           fs.unlinkSync(pathToFile)
           return response
    } catch (error) {
        fs.unlinkSync(pathToFile);  //remove file from local storage
        return null
    }
    
}

export {cloudinaryFileUpload}; 