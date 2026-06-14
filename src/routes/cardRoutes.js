// src/routes/cardRoutes.js
// -> mapping API endpoints untuk entitas kartu ke cardController
//      -> GET /         : getAllCards
//      -> GET /:id      : getCardById
//      -> POST /        : createCard
//      -> PUT /:id      : updateCard
//      -> DELETE /:id   : deleteCard

import { Router } from 'express';
import {
    getAllCards,
    getCardById,
    createCard,
    updateCard,
    deleteCard
} from '../controllers/cardController.js';

const router = Router();

// helper --------------------------------------------------------------------------

// mapping routes
router.get('/', getAllCards);
router.get('/:id', getCardById);
router.post('/', createCard);
router.put('/:id', updateCard);
router.delete('/:id', deleteCard);

// end of helper ------------------------------------------------------------------

export default router;
