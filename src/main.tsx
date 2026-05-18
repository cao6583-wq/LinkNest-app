import { AppRegistry } from "react-native";

import App from "../App";

AppRegistry.registerComponent("LinkNest", () => App);
AppRegistry.runApplication("LinkNest", {
  rootTag: document.getElementById("root")
});
