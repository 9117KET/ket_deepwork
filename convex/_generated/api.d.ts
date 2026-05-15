/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _shared_crypto from "../_shared/crypto.js";
import type * as _shared_google from "../_shared/google.js";
import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as calendarInternal from "../calendarInternal.js";
import type * as financialAdvisor from "../financialAdvisor.js";
import type * as financialSettings from "../financialSettings.js";
import type * as http from "../http.js";
import type * as plannerDays from "../plannerDays.js";
import type * as receiptParser from "../receiptParser.js";
import type * as sharing from "../sharing.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/crypto": typeof _shared_crypto;
  "_shared/google": typeof _shared_google;
  auth: typeof auth;
  calendar: typeof calendar;
  calendarInternal: typeof calendarInternal;
  financialAdvisor: typeof financialAdvisor;
  financialSettings: typeof financialSettings;
  http: typeof http;
  plannerDays: typeof plannerDays;
  receiptParser: typeof receiptParser;
  sharing: typeof sharing;
  userSettings: typeof userSettings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
