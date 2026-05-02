import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import transactionsRouter from "./transactions";
import alertsRouter from "./alerts";
import analyticsRouter from "./analytics";
import usersRouter from "./users";
import fraudCheckRouter from "./fraud-check";
import fraudBatchRouter from "./fraud-batch";
import rulesRouter from "./rules";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(transactionsRouter);
router.use(alertsRouter);
router.use(analyticsRouter);
router.use(usersRouter);
router.use(fraudCheckRouter);
router.use(fraudBatchRouter);
router.use(rulesRouter);

export default router;
