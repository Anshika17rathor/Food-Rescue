import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foodRescueRouter from "./foodrescue";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foodRescueRouter);

export default router;
