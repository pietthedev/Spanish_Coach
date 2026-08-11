import { course } from "../content/course.ts";
import { validateCourse } from "../content/validate.ts";

const parsed = validateCourse(course);
process.stdout.write(
  `Validated ${parsed.lessons.length} lessons, ${parsed.phrases.length} phrases and ${parsed.scenarios.length} mission.\n`,
);
