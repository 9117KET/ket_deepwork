/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _shared_auth from "../_shared/auth.js";
import type * as _shared_calendarTime from "../_shared/calendarTime.js";
import type * as _shared_challengeReminders from "../_shared/challengeReminders.js";
import type * as _shared_challengeValidators from "../_shared/challengeValidators.js";
import type * as _shared_crypto from "../_shared/crypto.js";
import type * as _shared_freeSlot from "../_shared/freeSlot.js";
import type * as _shared_google from "../_shared/google.js";
import type * as _shared_taskSync from "../_shared/taskSync.js";
import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as calendarInternal from "../calendarInternal.js";
import type * as challenges from "../challenges.js";
import type * as challengesInternal from "../challengesInternal.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as plannerDays from "../plannerDays.js";
import type * as reminders from "../reminders.js";
import type * as tasks from "../tasks.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/auth": typeof _shared_auth;
  "_shared/calendarTime": typeof _shared_calendarTime;
  "_shared/challengeReminders": typeof _shared_challengeReminders;
  "_shared/challengeValidators": typeof _shared_challengeValidators;
  "_shared/crypto": typeof _shared_crypto;
  "_shared/freeSlot": typeof _shared_freeSlot;
  "_shared/google": typeof _shared_google;
  "_shared/taskSync": typeof _shared_taskSync;
  auth: typeof auth;
  calendar: typeof calendar;
  calendarInternal: typeof calendarInternal;
  challenges: typeof challenges;
  challengesInternal: typeof challengesInternal;
  crons: typeof crons;
  email: typeof email;
  http: typeof http;
  plannerDays: typeof plannerDays;
  reminders: typeof reminders;
  tasks: typeof tasks;
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
