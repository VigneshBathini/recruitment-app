import * as service from "../services/interview.service.js";
function handle(fn,message){return async(req,res,next)=>{try{const data=await fn(req);return res.status(200).json({success:true,message,data});}catch(e){if(e.statusCode)return res.status(e.statusCode).json({success:false,message:e.message});return next(e);}};}
export const listInterviewsController=handle(req=>service.listService(req.user),"Interviews loaded");
export const getInterviewController=handle(req=>service.detailService(req.params.id,req.user),"Interview loaded");
export const createInterviewController=handle(req=>service.createService(req.body,req.user),"Interview scheduled");
export const updateInterviewController=handle(req=>service.updateService(req.params.id,req.body,req.user),"Interview updated");
export const completeInterviewController=handle(req=>service.completeService(req.params.id,req.user),"Interview completed");
export const submitFeedbackController=handle(req=>service.feedbackService(req.params.id,req.body,req.user),"Feedback submitted");
