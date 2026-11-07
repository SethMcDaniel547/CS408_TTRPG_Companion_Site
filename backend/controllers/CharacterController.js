"use strict";

const {
  validateCharacter,
  validateTokenImage,
  validateId,
} = require("../validation/validators");

// HTTP adapter for the signed-in player's characters. Validates at the
// boundary, delegates to CharacterService, forwards errors via next(error).
class CharacterController {
  constructor(characterService) {
    this.characterService = characterService;
  }

  setServiceErrorMessage(res) {
    res.locals.serviceErrorMessage =
      "Character service is temporarily unavailable.";
  }

  accountId(req) {
    return this.characterService.requireAccountId(req.session.username);
  }

  list = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const characters = await this.characterService.list(accountId);
      res.status(200).json({ characters });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const input = validateCharacter(req.body);
      const character = await this.characterService.create(accountId, input);
      res.status(201).json({ character });
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const id = validateId(req.params.characterId, "character id");
      const input = validateCharacter(req.body);
      const character = await this.characterService.update(accountId, id, input);
      res.status(200).json({ character });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const id = validateId(req.params.characterId, "character id");
      await this.characterService.remove(accountId, id);
      res.status(200).json({ deleted: true });
    } catch (error) {
      next(error);
    }
  };

  uploadToken = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const id = validateId(req.params.characterId, "character id");
      const image = validateTokenImage(req.body);
      const character = await this.characterService.saveToken(accountId, id, image);
      res.status(200).json({ character });
    } catch (error) {
      next(error);
    }
  };

  getToken = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const id = validateId(req.params.characterId, "character id");
      const token = await this.characterService.getToken(accountId, id);
      res
        .status(200)
        .set({
          "Content-Type": token.contentType,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        })
        .send(token.data);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { CharacterController };
