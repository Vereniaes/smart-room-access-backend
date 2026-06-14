// src/controllers/cardController.js
// -> handling API request/response orchestration for cards
//      -> getAllCards : ambil semua kartu
//      -> getCardById : ambil kartu by ID
//      -> createCard  : registrasi kartu baru
//      -> updateCard  : update status kartu
//      -> deleteCard  : hapus kartu dari sistem

import { sendResponse, sendError } from '../utils/response.js';
import {
    getDataAllCards,
    getDataCardById,
    createDataCard,
    updateDataCard,
    deleteDataCard
} from '../services/cardService.js';

// helper --------------------------------------------------------------------------

// function handler untuk mengambil list seluruh kartu
// input param : req (Express Request), res (Express Response)
// output : express JSON response
export const getAllCards = async (req, res) => {
    try {
        const cardsData = await getDataAllCards();
        return sendResponse(res, 200, { cards: cardsData }, "Cards retrieved successfully");
    } catch (error) {
        return sendError(res, 500, `Internal server error: ${error.message}`);
    }
};

// function handler untuk mengambil detail kartu by ID
// input param : req (Express Request), res (Express Response)
// output : express JSON response
export const getCardById = async (req, res) => {
    try {
        const cardData = await getDataCardById(req.params.id);
        if (!cardData) {
            return sendError(res, 404, "Card not found");
        }
        return sendResponse(res, 200, { card: cardData }, "Card retrieved successfully");
    } catch (error) {
        return sendError(res, 500, `Internal server error: ${error.message}`);
    }
};

// function handler untuk mendaftarkan kartu baru
// input param : req (Express Request dengan body { rfid_uid, valid_until }), res (Express Response)
// output : express JSON response (201 Created)
export const createCard = async (req, res) => {
    try {
        const newCard = await createDataCard(req.body);
        return sendResponse(res, 201, { card: newCard }, "Card registered successfully");
    } catch (error) {
        if (error.code === "DUPLICATE_RFID_UID") {
            return sendError(res, 409, "RFID UID is already registered in the system");
        }
        return sendError(res, 500, `Internal server error: ${error.message}`);
    }
};

// function handler untuk mengupdate data/status kartu
// input param : req (Express Request dengan params id & body { valid_until }), res (Express Response)
// output : express JSON response
export const updateCard = async (req, res) => {
    try {
        const updatedCard = await updateDataCard(req.params.id, req.body);
        if (!updatedCard) {
            return sendError(res, 404, "Card not found");
        }
        return sendResponse(res, 200, { card: updatedCard }, "Card updated successfully");
    } catch (error) {
        return sendError(res, 500, `Internal server error: ${error.message}`);
    }
};

// function handler untuk menghapus kartu dari database
// input param : req (Express Request), res (Express Response)
// output : express JSON response
export const deleteCard = async (req, res) => {
    try {
        const deletedCard = await deleteDataCard(req.params.id);
        if (!deletedCard) {
            return sendError(res, 404, "Card not found");
        }
        return sendResponse(res, 200, { card: deletedCard }, "Card deleted successfully");
    } catch (error) {
        return sendError(res, 500, `Internal server error: ${error.message}`);
    }
};

// end of helper ------------------------------------------------------------------
