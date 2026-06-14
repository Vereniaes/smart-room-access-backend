/**
 * src/routes/systemRoutes.js
 * 
 * -> router untuk endpoints informasi sistem & pengujian Telegram
 *      -> GET /info : mengambil detail status server & env
 *      -> POST /test-telegram : trigger ping message ke grup telegram
 * -> disini buat pendefinisian rute Express dan mapping ke fungsi controller
 */

import { Router } from "express";
import { getSystemInfo, testTelegramConnection } from "../controllers/systemController.js";

const router = Router();

// helper --------------------------------------------------------------------------

router.get("/info", getSystemInfo);
router.post("/test-telegram", testTelegramConnection);

// end of helper ------------------------------------------------------------------

export default router;
