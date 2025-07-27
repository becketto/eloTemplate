import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
    index("routes/home.tsx"),
    route("/compare", "routes/compare.tsx"),
    route("/external-images/*", "routes/external-images.$.tsx")
] satisfies RouteConfig
