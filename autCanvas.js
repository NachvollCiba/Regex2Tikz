/**
 * Created by dennis on 06/12/15.
 */


const ZOOM_STEP = 2;
const ZOOM_MAX = 100;
const STATE_RAD = .5;
const SNAP_RAD = .25;
const LBL_OFFSET = .15;

function CanvasController(canvas, automaton, controlElem) {
    // class member TODO make some private
    this.canvas = canvas;
    this.automaton = automaton;
    this.control = controlElem;
    this.camera = {zoom:40, x:this.canvas[0].width/2, y:this.canvas[0].height/2};
    this.changelistener = null;
    this.spatial = null;
    this.moving = null;
    this.xAligned = null;
    this.yAligned = null;
    this.showGrid = false;
    this.snap = false;


    this.loadAutomaton = function(aut) {
        this.automaton = aut;
        this.buildSpatial();

        this.snap = this.control.find("#slSnap").val();
        this.showGrid = this.control.find("#cbGrid").is(":checked");
    };

    this.drawAutomaton = function() {
        var ctx = this.canvas[0].getContext("2d");
        //ctx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);
        this.canvas[0].width = this.canvas[0].width;

        if (this.showGrid) {
            this.drawGrid(ctx);
        }

        var fontsize = Math.round(.5 * this.camera.zoom);
        ctx.font = fontsize + "px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";

        this.drawStates(ctx);
        this.drawTransitions(ctx);
        this.drawAlignment(ctx);
    };

    this.drawGrid = function(ctx) {
        var width = this.canvas[0].width; var height = this.canvas[0].height;
        var stepSize = Math.round(2* SNAP_RAD * this.camera.zoom);

        var startX = this.camera.x - Math.floor(this.camera.x / (stepSize)) * stepSize;
        var startY = this.camera.y - Math.floor(this.camera.y / (stepSize)) * stepSize;

        // draw major lines
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#000000";

        for (var x = startX; x <= width; x+= stepSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }

        for (var y = startY; y <= height; y+= stepSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }

        ctx.stroke();

        // draw minor lines
        ctx.beginPath();
        ctx.strokeStyle = "#bfbfbf";

        for (x = startX - Math.round(stepSize / 2); x <= width; x+= stepSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }

        for (y = startY - Math.round(stepSize / 2); y <= height; y+= stepSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }

        ctx.stroke();
    };

    this.drawStates = function(ctx) {
        var realRad = Math.round(STATE_RAD * this.camera.zoom);
        var finalRad = Math.max(realRad - 3, 0);
        var width = this.canvas[0].width; var height = this.canvas[0].height;
        var moving = this.moving;
        var that = this;
        var posX, posY;

        // draw the actual STATES
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#f2f2f2";
        ctx.lineWidth = 1;
        ctx.beginPath();
        this.automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            if (posX < -realRad || posX > width + realRad ||
                posY < -realRad || posY > height + realRad) {
                return; // state is not visible
            }
            if (state == moving) {
                return;
            }

            ctx.moveTo(posX + realRad, posY);
            ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);
            if (state.isFinal) {
                ctx.moveTo(posX + finalRad, posY);
                ctx.arc(posX, posY, finalRad, 0, 2 * Math.PI);
            }

        });
        ctx.fill();
        ctx.stroke();

        // draw the HIGHLIGHTED STATE
        if (moving !== null) {
            ctx.strokeStyle = "#000000";
            ctx.fillStyle = "#e5ecff";
            ctx.lineWidth = 1;
            ctx.beginPath();
            posX = that.screenX(moving.position[0]);
            posY = that.screenY(moving.position[1]);
            ctx.moveTo(posX + realRad, posY);
            ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);
            if (moving.isFinal) {
                ctx.moveTo(posX + finalRad, posY);
                ctx.arc(posX, posY, finalRad, 0, 2 * Math.PI);
            }
            ctx.stroke();
            ctx.fill();
        }

        // draw the STATE NAMES
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        this.automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            if (posX < -realRad || posX > width + realRad ||
                posY < -realRad || posY > height + realRad) {
                return; // state is not visible
            }
            ctx.fillText(toInternalID(state.name), posX, posY);
        });

        // draw the INCOMING LINE to the START STATE
        ctx.lineWidth = 2;
        ctx.beginPath();
        posX = that.screenX(this.automaton[0].position[0]);
        posY = that.screenY(this.automaton[0].position[1]);
        this.drawArrow(ctx, posX - 2 * realRad, posY, posX - realRad, posY);
        ctx.stroke();
    };

    function labelDir(fromState, toState) {
        // on which side do we draw a transition label?
        var dir = (discreetDirection(fromState.position, toState.position) + 1) % DIRECTIONS.length;
        return DIRECTIONS[dir];
    }

    this.drawTransitions = function(ctx) {
        var realRad = Math.round(STATE_RAD * this.camera.zoom);
        var zoom = this.camera.zoom;
        var width = this.canvas[0].width; var height = this.canvas[0].height;
        var that = this;

        // first of all: draw arrows
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;

        this.automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            var startVisible =
                posX >= -realRad || posX <= width + realRad ||
                posY >= -realRad || posY <= height + realRad;

            // draw self loops
            if (state.loop != null) {
                that.drawLoopArrow(ctx, posX, posY, state.loop.placement, realRad);
            }

            // draw transition lines
            for (var entry of state.outgoing.entries()) {
                var nextState = entry[0];

                var otherX = that.screenX(nextState.position[0]);
                var otherY = that.screenY(nextState.position[1]);

                var endVisible =
                    otherX >= -realRad || otherX <= width + realRad ||
                    otherY >= -realRad || otherY <= height + realRad;

                if (!startVisible && !endVisible) {
                    return; // transition is not visible
                }

                if (state.incoming.has(nextState)) {
                    that.drawBendedArrow(ctx, state.position, nextState.position);
                } else {
                    var dir = normalize(sub(nextState.position, state.position));

                    var startX = Math.round(posX + realRad * dir[0]);
                    var startY = Math.round(posY - realRad * dir[1]);
                    var endX = Math.round(otherX - realRad * dir[0]);
                    var endY = Math.round(otherY + realRad * dir[1]);

                    that.drawArrow(ctx, startX, startY, endX, endY);
                }
            }
        });

        ctx.stroke();

        // draw transition labels
        this.automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            var startVisible =
                posX >= -realRad || posX <= width + realRad ||
                posY >= -realRad || posY <= height + realRad;

            // draw self loops
            if (state.loop != null) {
                that.drawLoopLabel(ctx, posX, posY,
                    state.loop.placement, state.loop.symbs.replace($("#emptySymb").val(), "ε"), realRad);
            }

            for (var entry of state.outgoing.entries()) {
                var nextState = entry[0];
                var label = entry[1].symbs.replace($("#emptySymb").val(), "ε");

                var otherX = that.screenX(nextState.position[0]);
                var otherY = that.screenY(nextState.position[1]);

                var endVisible =
                    otherX >= -realRad || otherX <= width + realRad ||
                    otherY >= -realRad || otherY <= height + realRad;

                if (!startVisible && !endVisible) {
                    return; // transition is not visible
                }

                if (state.incoming.has(nextState)) {
                    that.drawBendedLabel(ctx, state.position, nextState.position, entry[1].placement, label);
                } else {
                    var midX = Math.round(posX + (otherX - posX) / 2);
                    var midY = Math.round(posY + (otherY - posY) / 2);

                    // determine position
                    const offset = Math.round(LBL_OFFSET * zoom);
                    switch (entry[1].placement) {
                        case "above":
                            midY -= offset;
                            break;
                        case "below":
                            midY += offset;
                            break;
                        case "left":
                            midX -= offset;
                            break;
                        case "right":
                            midX += offset;
                            break;
                    }

                    setTextAlign(ctx, entry[1].placement);
                    ctx.fillText(label, midX, midY);
                }
            }
        });
    };

    this.drawAlignment = function(ctx) {
        if (this.moving == null) {
            return; // no alignment to draw
        }

        var posX = this.screenX(this.moving.position[0]);
        var posY = this.screenY(this.moving.position[1]);
        var otherX, otherY;

        // draw lines to aligned states
        ctx.beginPath();
        if (this.xAligned != null) {
            otherX = this.screenX(this.xAligned.position[0]);
            otherY = this.screenY(this.xAligned.position[1]);

            ctx.lineWidth = 3;
            ctx.strokeStyle = "#A52A2A";
            ctx.moveTo(posX, posY);
            ctx.lineTo(otherX, otherY);
        }

        if (this.yAligned != null) {
            otherX = this.screenX(this.yAligned.position[0]);
            otherY = this.screenY(this.yAligned.position[1]);

            ctx.lineWidth = 3;
            ctx.strokeStyle = "#A52A2A";
            ctx.moveTo(posX, posY);
            ctx.lineTo(otherX, otherY);
        }
        ctx.stroke();
        ctx.strokeStyle = "#000000";
    };

    this.drawArrow = function (ctx, x1, y1, x2, y2){
        var angle = Math.atan2(y2 - y1, x2 - x1);

        // draw main line
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        this.drawArrowHead(ctx, x2, y2, angle);
    };

    this.drawArrowHead = function(ctx, x, y, angle) {
        var headlen = .25 * this.camera.zoom;
        ctx.lineTo(Math.round(x - headlen * Math.cos(angle - Math.PI/6)),
            Math.round(y - headlen * Math.sin(angle - Math.PI/6)));
        ctx.moveTo(x, y);
        ctx.lineTo(Math.round(x - headlen * Math.cos(angle + Math.PI/6)),
            Math.round(y - headlen * Math.sin(angle + Math.PI/6)));
    };

    this.drawBendedArrow = function(ctx, pos1, pos2) {
        const dis = 3*STATE_RAD;// distance in world coordinates
        const angle = 5.75959; // 30°

        var dir =  scalarMult(normalize(sub(pos2, pos1)), STATE_RAD);

        var start = add(pos1, rotate(dir,  angle));
        var end   = sub(pos2, rotate(dir, -angle));

        var midX = start[0] + (end[0] - start[0]) / 2;
        var midY = start[1] + (end[1] - start[1]) / 2;

        scalarMultInPlace(dir, dis);
        var control = [midX + dir[1], midY - dir[0]];

        // translate from world to screen coordinates
        this.toScreen(start);
        this.toScreen(end);
        this.toScreen(control);

        ctx.moveTo(start[0], start[1]);
        ctx.quadraticCurveTo(control[0], control[1], end[0], end[1]);

        this.drawArrowHead(ctx, end[0], end[1], Math.atan2(end[1]-control[1], end[0]-control[0]));
    };

    this.drawBendedLabel = function(ctx, pos1, pos2, lblDirection, label) {
        const dis = 3*STATE_RAD;// distance in world coordinates
        const angle = 5.75959; // 30°

        var dir =  scalarMult(normalize(sub(pos2, pos1)), STATE_RAD);

        var start = add(pos1, rotate(dir,  angle));
        var end   = sub(pos2, rotate(dir, -angle));

        var midX = start[0] + (end[0] - start[0]) / 2;
        var midY = start[1] + (end[1] - start[1]) / 2;

        scalarMultInPlace(dir, dis);
        var labelPos = [midX + dir[1], midY - dir[0]];
        this.toScreen(labelPos);

        // draw label
        var lblOffset = Math.round(LBL_OFFSET * this.camera.zoom + 10);
        switch (lblDirection) {
            case "above":
                labelPos[1] -= lblOffset;
                break;
            case "below":
                labelPos[1] += lblOffset;
                break;
            case "left":
                labelPos[0] -= lblOffset;
                break;
            case "right":
                labelPos[0] += lblOffset;
                break;
        }

        setTextAlign(ctx, lblDirection);
        ctx.fillText(label, labelPos[0], labelPos[1]);
    };

    this.drawLoopArrow = function(ctx, x, y, direction, realRad) {
        var loopDis = realRad;
        var loopExc = realRad;
        const angle = 0.523599; // 30°

        var dir, mid, control1, control2;
        switch(direction) {
            case "above":
                dir = [0,-realRad];
                mid = [x, y - realRad - loopDis];
                control1 = [x - loopExc, mid[1]];
                control2 = [x + loopExc, mid[1]];
                break;
            case "below":
                dir = [0,realRad];
                mid = [x, y + realRad + loopDis];
                control1 = [x + loopExc, mid[1]];
                control2 = [x - loopExc, mid[1]];
                break;
            case "left":
                dir = [-realRad,0];
                mid = [x - realRad - loopDis, y];
                control1 = [mid[0], y + loopExc];
                control2 = [mid[0], y - loopExc];
                break;
            case "right":
                dir = [realRad,0];
                mid = [x + realRad + loopDis, y];
                control1 = [mid[0], y - loopExc];
                control2 = [mid[0], y + loopExc];
                break;
        }

        var end = [Math.round(x + dir[0] * Math.cos(angle) - dir[1] * Math.sin(angle)),
            Math.round(y + dir[0] * Math.sin(angle) + dir[1] * Math.cos(angle))];

        var start = [Math.round(x + dir[0] * Math.cos(-angle) - dir[1] * Math.sin(-angle)),
            Math.round(y + dir[0] * Math.sin(-angle) + dir[1] * Math.cos(-angle))];

        mid = [Math.round(mid[0]), Math.round(mid[1])];
        control1 = [Math.round(control1[0]), Math.round(control1[1])];
        control2 = [Math.round(control2[0]), Math.round(control2[1])];

        ctx.moveTo(start[0], start[1]);
        ctx.quadraticCurveTo(control1[0], control1[1], mid[0], mid[1]);
        ctx.moveTo(mid[0], mid[1]);
        ctx.quadraticCurveTo(control2[0], control2[1], end[0], end[1]);
        this.drawArrowHead(ctx, end[0], end[1], Math.atan2(end[1]-control2[1], end[0]-control2[0]));
    };

    this.drawLoopLabel = function(ctx, x, y, direction, label, realRad) {
        var lblOffset = Math.round(LBL_OFFSET * this.camera.zoom);
        var loopDis = realRad;
        var lblPos, mid, dir;

        switch (direction) {
            case "above":
                dir = [0,-realRad];
                mid = y - realRad - loopDis;
                lblPos = [x, mid - lblOffset];
                break;
            case "below":
                dir = [0,realRad];
                mid = y + realRad + loopDis;
                lblPos = [x, mid + lblOffset];
                break;
            case "left":
                dir = [-realRad,0];
                mid = x - realRad - loopDis;
                lblPos = [mid - lblOffset, y];
                break;
            case "right":
                dir = [realRad,0];
                mid = x + realRad + loopDis;
                lblPos = [mid + lblOffset, y];
                break;
        }

        setTextAlign(ctx, direction);
        ctx.fillText(label, Math.round(lblPos[0]), Math.round(lblPos[1]));
    };

    function setTextAlign(ctx, direction) {
        switch(direction) {
            case "above":
                ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
                break;
            case "below":
                ctx.textAlign = "center"; ctx.textBaseline = "hanging";
                break;
            case "left":
                ctx.textAlign = "right"; ctx.textBaseline = "middle";
                break;
            case "right":
                ctx.textAlign = "left"; ctx.textBaseline = "middle";
                break;
        }
    }

    this.zoomIn = function(amount) {
        this.camera.zoom += amount;
        this.camera.zoom = Math.min(this.camera.zoom, ZOOM_MAX);
        this.drawAutomaton();
    };

    this.zoomOut = function(amount) {
        this.camera.zoom -= amount;
        this.camera.zoom = Math.max(this.camera.zoom, 0);
        this.drawAutomaton();
    };

    // center both automaton and camera around 0,0
    this.center = function() {
        // center camera
        this.camera.x = Math.round(this.canvas[0].width / 2);
        this.camera.y = Math.round(this.canvas[0].height / 2);

        // center states
        var offsetX = 0; var offsetY = 0;
        this.automaton.forEach(function(state) {
            offsetX += state.position[0];
            offsetY += state.position[1];
        });

        offsetX /= this.automaton.length;
        offsetY /= this.automaton.length;
        var that = this;
        this.automaton.forEach(function(state) {
            state.position[0] -= offsetX;
            state.position[1] -= offsetY;
            that.updateStatePositional(state);
        });

        this.drawAutomaton();
        cntrl.changelistener(selected);
    };

    function updateTransitionDirs(state) {
        state.freeDirs = state.isStart? ["below", "right", "above"] : ["left", "below", "right", "above"];
        var dir;

        for (var entry of state.outgoing.entries()) {
            dir = DIRECTIONS[discreetDirection(state.position, entry[0].position)];
            removeElem(state.freeDirs, dir);
        }
        for (var nextState of state.incoming) {
            dir = DIRECTIONS[discreetDirection(state.position, nextState.position)];
            removeElem(state.freeDirs, dir);
        }

        if (state.loop != null) {
            state.loop.placement = state.freeDirs.length > 0? state.freeDirs.pop() : "left";
        }

    }

    this.updateStatePositional = function(state) {
        // update state labels
        for (var entry of state.outgoing.entries()) {
            entry[1].placement = labelDir(state, entry[0]);

            if (entry[0].loop != null) {
                updateTransitionDirs(entry[0]);
            }
        }
        for (var nextState of state.incoming) {
            nextState.outgoing.get(state).placement = labelDir(nextState, state);

            if (nextState.loop != null) {
                updateTransitionDirs(nextState);
            }
        }

        if (state.loop != null) {
            updateTransitionDirs(state);
        }

        // update spatial data structure
        this.spatial.move(state);
    };

    this.buildSpatial = function() {
        var spatialStruc = new SpatialStruct(SNAP_RAD);

        this.automaton.forEach(function(state) {
            spatialStruc.put(state);
        });

        this.spatial = spatialStruc;
    };

    this.screenX = function(worldX) {
        return Math.round(worldX * this.camera.zoom + this.camera.x);
    };

    this.screenY = function(worldY) {
        return Math.round(-worldY * this.camera.zoom + this.camera.y);
    };

    this.toScreen = function(worldVec) {
        worldVec[0] = this.screenX(worldVec[0]);
        worldVec[1] = this.screenY(worldVec[1]);
    };

    // listener
    var cntrl = this;
    var selected = null;
    var lastMouse = {x:-1, y:-1};
    var locked = {x: false, y:false};
    var accDelta = {x:0, y:0};

    function reset() {
        if ((selected instanceof State) && cntrl.changelistener != null) {
            cntrl.changelistener(selected);
        }

        selected = null;

        cntrl.moving = null;
        cntrl.xAligned = null;
        cntrl.yAligned = null;

        locked.x = false; locked.y = false;
        accDelta.x = 0; accDelta.y = 0;

        cntrl.drawAutomaton();
    }

    this.canvasMouseUp = function(event) {
        event.preventDefault();
        reset();
    };

    function findAligned(state) {
        cntrl.xAligned = cntrl.spatial.xNeighbour(state);
        cntrl.yAligned = cntrl.spatial.yNeighbour(state);
    }

    this.canvasMouseDown = function(event) {
        event.preventDefault();

        // convert from screen to "world" coordinates
        var mouseX = (event.offsetX - cntrl.camera.x) / cntrl.camera.zoom;
        var mouseY = -(event.offsetY - cntrl.camera.y) / cntrl.camera.zoom;

        lastMouse.x = event.offsetX; lastMouse.y = event.offsetY;

        selected = {};
        for (var i = 0; i < cntrl.automaton.length; i++) {
            var state = cntrl.automaton[i];

            // test if clicked on one of the states
            if (euclideanDistance(state.position, [mouseX, mouseY]) < STATE_RAD) {
                selected = state;
                selected.canvasPos = [selected.position[0], selected.position[1]];
                findAligned(state);
                break;
            }
        }
    };

    this.canvasMouseMove = function(event) {
        event.preventDefault();

        if (selected != null) {
            // compute the moved mouse offset
            var deltaX = event.offsetX - lastMouse.x;
            var deltaY = event.offsetY - lastMouse.y;

            if (selected instanceof State) {
                cntrl.moving = selected;

                // translate the selected state
                var movX = deltaX / cntrl.camera.zoom;
                var movY = deltaY / cntrl.camera.zoom;

                selected.canvasPos[0] += movX;
                selected.canvasPos[1] -= movY;

                if (cntrl.snap == "neighbour") {
                    if (locked.x) {
                        var distX = Math.abs(selected.canvasPos[0] - selected.position[0]);
                        if (distX > 2 * SNAP_RAD) {
                            selected.position[0] = selected.canvasPos[0];
                        }
                    } else {
                        selected.position[0] = selected.canvasPos[0];
                    }

                    if (locked.y) {
                        var distY = Math.abs(selected.canvasPos[1] - selected.position[1]);
                        if (distY > 2 * SNAP_RAD) {
                            selected.position[1] = selected.canvasPos[1];
                        }
                    } else {
                        selected.position[1] = selected.canvasPos[1];
                    }
                } else if (cntrl.snap == "grid") {
                    selected.position[0] = Math.round(selected.canvasPos[0] / SNAP_RAD) * SNAP_RAD;
                    selected.position[1] = Math.round(selected.canvasPos[1] / SNAP_RAD) * SNAP_RAD;
                } else if (cntrl.snap == "none") {
                    selected.position[0] = selected.canvasPos[0];
                    selected.position[1] = selected.canvasPos[1];
                }

                // update aligned states
                cntrl.updateStatePositional(selected);
                findAligned(selected);

                if (cntrl.snap == "neighbour") {
                    if (cntrl.xAligned != null) {
                        selected.position[1] = cntrl.xAligned.position[1];
                        cntrl.updateStatePositional(selected);
                    }

                    if (cntrl.yAligned != null) {
                        selected.position[0] = cntrl.yAligned.position[0];
                        cntrl.updateStatePositional(selected);
                    }

                    locked = {x: cntrl.yAligned != null, y: cntrl.xAligned != null};
                }
            } else { // move the camera
                cntrl.camera.x += deltaX;
                cntrl.camera.y += deltaY;
            }

            cntrl.drawAutomaton();

            lastMouse.x = event.offsetX;
            lastMouse.y = event.offsetY;
        }
    };

    this.canvasMouseWheel = function(event) {
        event.preventDefault();

        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
            cntrl.zoomIn(ZOOM_STEP);
        }
        else {
            cntrl.zoomOut(ZOOM_STEP)
        }
    };

    this.canvasMouseExit = function(event) {
        reset();
    };

    // register the listeners
    this.canvas.mouseup(this.canvasMouseUp);
    this.canvas.mousedown(this.canvasMouseDown);
    this.canvas.mousemove(this.canvasMouseMove);
    this.canvas.mouseleave(this.canvasMouseExit);
    this.canvas.bind('mousewheel DOMMouseScroll', this.canvasMouseWheel);

    // register listeners for the control panel
    this.control.find("#btnZoomIn").click(function(event) {
        cntrl.zoomIn(3*ZOOM_STEP);
    });

    this.control.find("#btnZoomOut").click(function(event) {
        cntrl.zoomOut(3*ZOOM_STEP);
    });

    this.control.find("#cbGrid").click(function(event) {
        cntrl.showGrid = cntrl.control.find("#cbGrid").is(":checked");
        cntrl.drawAutomaton();
    });

    this.control.find("#btnCenter").click(function(event) {
        cntrl.center();
    });

    this.control.find("#btnAlign").click(function(event) {
        alignAutomaton(cntrl.automaton, SNAP_RAD);
        cntrl.drawAutomaton();
    });

    this.control.find("#slSnap").click(function(event){
        cntrl.snap = this.value;
        cntrl.drawAutomaton();
    });
}
