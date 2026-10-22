import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Every quarter hour, so a 10:00 deadline is chased by ~10:15 in any zone.
// The sweep itself is cheap when nobody is due: one indexed read per member.
crons.interval("challenge reminders", { minutes: 15 }, internal.reminders.sweep, {})

export default crons
