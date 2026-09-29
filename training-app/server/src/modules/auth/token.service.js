import jwt from 'jsonwebtoken';
import { config } from '../../config.js';

const verifyOptions = { issuer: 'training-api', audience: 'training-client' };

export const signAccessToken = (claims) =>
  jwt.sign(claims, config.JWT_ACCESS_SECRET, { ...verifyOptions, expiresIn: config.JWT_ACCESS_TTL_MINUTES * 60 });

export const verifyAccessToken = (token) => jwt.verify(token, config.JWT_ACCESS_SECRET, verifyOptions);

export const accessTokenTtlSeconds = () => config.JWT_ACCESS_TTL_MINUTES * 60;
