# M weather presence — original actor and accessories

Base: V69 d640d9e. Branch: feat/m-weather-presence.

The original character and umbrella already shared one canvas, but the body-only
Z envelope did not include the forward-offset accessory. A portion of the canopy
could therefore pass the card's depth plane while M was behind it.

All original and attached mesh/line materials now share one read-only card stencil.
Existing rounded card geometry writes the membership before actor rendering; the
actor's internal depth, PBR textures, transparency and physical transforms remain.
This adds no offscreen pass, global umbrella hiding or screen-position exception.
If stencil is unavailable, the existing planner is told that behind-card depth is
unsupported and selects safe foreground routes instead.

Native comparison on the original V6: 800 desktop /317 mobile unwanted card pixels
became zero, with positive foreground and transparent blank controls. Six sampled
card poses per profile were clear. Stage1 native11/11 checks passed; original
31bones/14influences/4skinsets/10maps/6clips/correctives/HAT eyes are unchanged.
Geometry refinement and moving-route/weather-transition validation are next;
this is not a universal final visual or production-publication claim.

Primary rendering references: [Three.js Material](https://threejs.org/docs/pages/Material.html)
and [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).
Exact r184 clear/state behavior was checked against the versioned renderer source.
