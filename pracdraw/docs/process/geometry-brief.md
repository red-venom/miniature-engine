# Template for a geometry brief (PracDraw: a hard picture, before an author draws it)

The lead writes one for each hard row of the inventory (a 3D structure, a family of molecules) before an author starts. A row of `spec/diagrams.json` says what to draw; a geometry brief says exactly where everything goes, so that two authors would draw the same picture and a reviewer can check it. Keep it to one page.

1. **The picture.** The inventory row id, the symbol id, and what a student sees, in two sentences.
2. **The parts and their count.** Every kind of part (atom, bond, ring, lobe), how many of each, and which of them the science test counts. Give the numbers a test can check (60 atoms and 90 bonds in C60; 8 ions in a sodium chloride cube).
3. **The construction.** The coordinates, or the rule that gives them: the lattice vectors, the ring radii, the angle, the spacing. In the symbol's own frame (x = 0 on the centre line, y = 0 at the top, y down). Give the numbers for the default size and say how they scale.
4. **The projection.** For a 3D picture, rule S14: which axis is the front face, the depth vector (45° up and to the right at half length), and which lines are hidden and dashed. Say how the hidden-line decision is made for this picture, not only that it is made.
5. **The edges.** What is drawn at the edge of a patch (stubs, a wavy cut line, open bonds), so that "every atom has three bonds" is not false at the edge.
6. **The fills and the marks.** Which parts are tint (with hatch), which are white, which are ink; sizes of the circles; where text goes (12 to 18 u) and what it says.
7. **The parameters.** For each: the values, the default, what it changes, and which combinations are not allowed (and what happens: clamp, hide, or draw the neutral picture).
8. **The checks.** The science checks, as sentences a test can turn into code, and the two or three sizes at which the picture must still read (the default, the minimum, 1.5 times).
9. **Not in scope.** What the picture does not show, so that nobody adds it.
