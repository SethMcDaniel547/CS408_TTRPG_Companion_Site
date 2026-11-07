"use strict";

const { validateCharacter, validateTokenImage } = require("../validation/validators");

// HTTP adapter for the signed-in player's character. Validates at the boundary,
// delegates to CharacterService, forwards errors via next(error).
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

  get = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const character = await this.characterService.getCharacter(accountId);
      res.status(200).json({ character });
    } catch (error) {
      next(error);
    }
  };

  save = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const input = validateCharacter(req.body);
      const character = await this.characterService.saveCharacter(accountId, input);
      res.status(200).json({ character });
    } catch (error) {
      next(error);
    }
  };

  uploadToken = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const image = validateTokenImage(req.body);
      const character = await this.characterService.saveToken(accountId, image);
      res.status(200).json({ character });
    } catch (error) {
      next(error);
    }
  };

  getToken = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const token = await this.characterService.getToken(accountId);
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
