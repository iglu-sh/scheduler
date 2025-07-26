import type {NotificationType, Notification} from "@iglu-sh/types/controller";

const test: NotificationType = "new"; // Valid type
const notification:Notification = {
    type: "new",
    builder_id: "12345",
    timestamp: Date.now().toString(),
}