import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js"
import { cloudinaryFileUpload } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"

const generateAcccessAndRefreshTokens = async(userID)=>{
    try {
        const user = await User.findById(userID)
        const accessToken =  user.generateAccessToken()
        const refreshToken =  user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something wnet wrong")
    }
}

const registerUser = asyncHandler( async(req, res)=>{
   
    // get userdetails from frontend
   const {fullname, email, username, password } =  req.body
   console.log("email:", email);

//    validation
        
    if(
        [fullname, email, username, password].some((field) =>
            field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    // if username or email already exists
    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })
    if(existedUser){
        throw new ApiError(409, "User already exists")
    }

    // check for images and avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
        

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar File is required")
    }

    // upload files to cloudinary

    const avatar = await cloudinaryFileUpload(avatarLocalPath)
    const coverImage = await cloudinaryFileUpload(coverImageLocalPath)
    console.log(avatar);
    

    if(!avatar){
        throw new ApiError(400, "Avatar File is required")
    }

    // create user object in db
    
    const user = await User.create({
        fullname,
        username: username.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""

    })

    // remove password and refresh token

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // check for user creation
    if(!createdUser){
        throw new ApiError(500, "Something went wrong" )
    }

    // if user created then return result
    return res.status(201).json(
        new apiResponse(200, createdUser, "User created successfully!")
    )
} )

const loginUser = asyncHandler(async(req, res)=>{

    // req body -> data

    const {email, username, password} = req.body;
    
    if(!(username || email)){
        throw new ApiError(400, "username or email required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exists!!")
    }

    const isPasswordVAlid = await user.isPasswordCorrect(password)

    if(!isPasswordVAlid){
        throw new ApiError(401, "Incorrect password")
    }

    const{ accessToken, refreshToken } = await 
    generateAcccessAndRefreshTokens(user._id);

    const loggedInUser = await User
                        .findById(user._id)
                        .select(" -password, -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new apiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in sucessfully!!"
        )
    )


})

const logOutUser =  asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(
        req.user._id, 
        {
            $unset: {
                refreshToken: 1 // this removes the field from the document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",  options)
    .clearCookie("refreshToken",  options)
    .json(new apiResponse(200, {}, "User logged Out"))
})


// verify refresh token
const refreshAccessToken = asyncHandler(async(req, res)=>{

  try {
      const incomingRefreshToken = req.cookies.refreshToken ||
      req.body.refreshToken
  
      if(!incomingRefreshToken){
          throw new ApiError(401, "invalid authorization!")
      }
  
      const decodedrefreshToken =  jwt.verify(
          incomingRefreshToken, 
          process.env.REFRESH_TOKEN)
  
     const user = await User.findById(decodedrefreshToken?._id) 
     if(!user){
      throw new ApiError(401, "User not found!")
     }  
     
     if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "Refresh token is expired or used")
     }
  
     const options = {
      httpOnly: true,
      secure: true
     }
   const { accessToken, newRefreshToken} =
    await generateAcccessAndRefreshTokens(user._id)
  
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new apiResponse(
          200,
          {accessToken, refreshToken: newRefreshToken},
          "Access Token Refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(400, error?.message || "invalid access token")
  }

})

// change password
const changeUserPassword = asyncHandler(async(req, res) =>{
    const{oldPassword, newPassword, confirmPassword} = req.body

    const user =  await User.findById(req.user?._id)
    const isPasswordCorrect = user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400, "Incorrect old Password")
    }

    if(!(newPassword === confirmPassword)){
        throw new ApiError(400, "Passwords do not match!!")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new apiResponse(200, {}, "Password changed Successfully"))


})

const currentUser = asyncHandler(async(req, res)=>{
    res
    .status(200)
    .json(new apiResponse(200, req.user, "Current User fetched successfully"))
})

//update user details
const updateAccountDetails = asyncHandler(async(req,res)=>{

    const {fullname, username, email} = req.body

    if(!fullname || !username || !email){
        throw new ApiError(400, "All fields required")
    }

   const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                username,
                email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, {}, "User details changed successfully"))
})

// update files

const updateAvatar = asyncHandler(async(req, res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar files missing")
    }

    const avatar = await cloudinaryFileUpload(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "error while uploading")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, {}, "avatar changed successfully"))
})

const updateCoverImage = asyncHandler(async(req, res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await cloudinaryFileUpload(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "error while uploading")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, {}, "cover image changed successfully"))

})

const getUserChannelProfile = asyncHandler(async(req, res)=>{

    //    get username from url
   
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
    
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"  //field
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"  //field
            }
        },
        {
            $addFields:{
                subscriberCount:{
                    $size: "$subscribers"  //count of the field
                }
            }
        },
        {
            $addFields:{
                subscribedToCount:{
                    $size: "$subscribedTo"  //count of the field
                },
                isSubscribed:{
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username:1,
                subscriberCount:1,
                subscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1
    
            }
        }
    
        
    ])

    // channel will be returned as an array

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, channel[0], "User channel fetched successfully")
    )
    
})

const getUserWatchHistory = asyncHandler(async(req, res)=>{
    //  get user id
    // get video id
    // get owner_id from video model which is again a user_id
    // nested pipelines
    
    
    const user = await User.aggregate([
        {
            $match: {
                // we cannot directly use mongoose inside a aggregation pipeline
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watcHistory",
                pipeline: [
                    { 
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
     ])

     return res
     .status(200)
     .json(new apiResponse(
        200,
        user[0].watchHistory,
        "watch history fetched successfully!"
     ))
})





export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeUserPassword,
    currentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getUserWatchHistory
}


