var canvas = document.querySelector('.canvas')
var graphicsContext = canvas.getContext('2d', { alpha: false })
var desiredFrameRate = 60

const ButtonFont = {
    name: 'Avenir',
    size: 18
}

class Size {
    constructor(width, height) {
        this.width = width
        this.height = height
    }

    get middle() {
        return new Point(this.width / 2, this.height / 2)
    }

    add(size) {
        return new Size(this.width + size.width, this.height + size.height)
    }

    subtract(size) {
        return new Size(this.width - size.width, this.height - size.height)
    }
}

class Point {
    constructor(x, y) {
        this.x = x
        this.y = y
    }

    add(point) {
        return new Point(this.x + point.x, this.y + point.y)
    }

    subtract(point) {
        return new Point(this.x - point.x, this.y - point.y)
    }

    equals(point) {
        return this.x == point.x && this.y == point.y
    }
}

class Rect {
    constructor(position, size) {
        this.position = position || new Point(0, 0)
        this.size = size || new Size(0, 0)
    }

    intersects(withRect) {
        return !(
            withRect.position.x > this.position.x + this.size.width ||
            withRect.position.x + withRect.size.width < this.position.x ||
            withRect.position.y > this.position.y + this.size.height ||
            withRect.position.y + withRect.size.height > this.position.y
        )
    }

    contains(point) {
        return (
            this.position.x <= point.x &&
            this.position.y <= point.y &&
            this.position.x + this.size.width >= point.x &&
            this.position.y + this.size.height >= point.y
        )
    }
}

class Color {
    constructor(red, green, blue, alpha) {
        this.red = red !== undefined ? red : 0
        this.green = green !== undefined ? green : 0
        this.blue = blue !== undefined ? blue : 0
        this.alpha = alpha !== undefined ? alpha : 1
    }

    randomColor() {
        this.red = Math.round(Math.random() * 255)
        this.green = Math.round(Math.random() * 255)
        this.blue = Math.round(Math.random() * 255)
        return this
    }

    get transparent() {
        this.red = 0
        this.green = 0
        this.blue = 0
        this.alpha = 0
        return this
    }

    toString() {
        return `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`
    }
}

function getContainerSize() {
    return new Size(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio)
}

function resize(size) {
    canvas.setAttribute('width', size.width)
    canvas.setAttribute('height', size.height)
}

class EventEmitter {
    constructor() {
        this.events = {}
    }

    fireEvent(event, args) {
        if (this.events[event]) {
            for (var i = 0; i < this.events[event].length; i++) {
                if (this.events[event][i]) {
                    if (args) {
                        this.events[event][i](...args)
                    } else {
                        this.events[event][i]()
                    }
                }
            }
        }
    }

    on(event, handler) {
        if (!this.events[event]) {
            this.events[event] = []
        }
        this.events[event].push(handler)
    }
}

class System {
    constructor() {
        this.containerSize = new Size(256, 256)
        this.graphicsContext = graphicsContext
        this.rootView = new View(
            new Rect(
                new Point(0, 0),
                new Point(this.containerSize.width / devicePixelRatio, this.containerSize.height / devicePixelRatio)
            ),
            new Color(255, 255, 255)
        )
        this.windowManager = new WindowManager()
        this.cursorPosition = new Point(0, 0)
        this.rootView.topMostView = new ImageView(new Rect(this.cursorPosition, new Size(32, 32)), 'resources/cursor.png')
        this.backgroundView = new View(this.rootView.rect, new Color(255, 255, 255, 1)) // new Color(38, 81, 99)
        this.rootView.addChild(this.backgroundView)
        this.rootView.on('mousemove', position => {
            this.cursorPosition = new Point(position.x, position.y)
            this.rootView.topMostView.rect.position = this.cursorPosition
        })
        this.backgroundView.on('mousedown', () => {
            this.windowManager.blurAll()
        })
        this.activeInputView = null
        this.rootView.on('keydown', function () {
            if (system.activeInputView) {
                system.activeInputView.fireEvent('keydown', arguments)
            }
        })
        this.rootView.on('keyup', function () {
            if (system.activeInputView) {
                system.activeInputView.fireEvent('keyup', arguments)
            }
        })
    }

    blurInput() {
        if (system.activeInputView) {
            system.activeInputView.active = false
            system.activeInputView = null
        }
    }

    init(containerSize) {
        this.containerSize = containerSize
        this.rootView.rect.size = new Size(this.containerSize.width / devicePixelRatio, this.containerSize.height / devicePixelRatio)
    }
}

class View extends EventEmitter {
    constructor(rect, color, shadowEnabled) {
        super()
        var that = this
        this.rect = rect || new Rect
        this.background = color || new Color
        this.children = []
        this.parent = null
        this.__absolutePosition = new Point(0, 0)
        this.callOnceCalled = false

        this.on(...this.propagateMouseEvent('mousedown'))
        this.on(...this.propagateMouseEvent('mouseup'))
        this.on(...this.propagateMouseEvent('mousemove'))
        this.topMostView = null
        this.__active = false
        this.shadowEnabled = shadowEnabled || false
        this.shadow = {
            shadowOpacity: 0.25,
            shadowBlur: 32,
            shadowOffsetY: 4,
        }
        this.borderWidth = 0
        this.borderColor = new Color(0, 0, 0, 0.25)
        this.roundedCorners = false
        this.cornerRadius = {
            topLeft: 0,
            topRight: 0,
            bottomLeft: 0,
            bottomRight: 0
        }
    }

    blurAllInputs(){
        for(var i = 0; i < this.children.length; i++){
            var child = this.children[i]
            if(child.constructor == TextBox){
                child.active = false
            }else{
                child.blurAllInputs()
            }
        }
    }

    get active() {
        return this.__active
    }

    set active(active) {
        if (active !== this.__active) {
            console.log(active, this)
            if (active) {
                this.parent.blurAll()
            }
            this.__active = active
        }
    }

    blurAll() {
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i]
            child.active = false
        }
    }

    setTop(child) {
        var childIndex = this.children.indexOf(child)
        this.children.splice(childIndex, 1)
        this.children.push(child)
    }

    setBottom(child) {
        var childIndex = this.children.indexOf(child)
        this.children.splice(childIndex, 1)
        this.children.unshift(child)
    }

    top() {
        this.parent.setTop(this)
    }

    bottom() {
        this.parent.setBottom(this)
    }

    propagateMouseEvent(eventName) {
        var that = this
        return [eventName, function () {
            var view = that.viewAt(arguments[0])
            if (view) {
                arguments[1] = view
                view.fireEvent(eventName, arguments)
            }
        }]
    }

    get absoluteRect() {
        return new Rect(this.__absolutePosition, this.rect.size)
    }

    set absolutePosition(absolutePosition) {
        this.__absolutePosition = absolutePosition
    }

    get size() {
        return this.rect.size
    }

    setSize(size) {
        this.rect.size = size
        this.fireEvent('resize', [this.rect.size])
    }

    set position(position) {
        this.rect.position = position
    }

    get position() {
        return this.rect.position
    }

    viewAt(position) {
        for (var i = this.children.length - 1; i >= 0; i--) {
            var child = this.children[i]
            if (child.absoluteRect.contains(position)) {
                return child
            }
        }
        return null
    }

    addChild(view) {
        view.parent = this
        this.children.push(view)
        view.fireEvent('mount', [this])
    }

    render(graphicsContext, parent) {
        this.absolutePosition = new Point(
            (parent ? parent.absoluteRect.position.x : 0) + this.rect.position.x,
            (parent ? parent.absoluteRect.position.y : 0) + this.rect.position.y
        )

        if (this.shadowEnabled) {
            graphicsContext.shadowColor = `rgba(11, 62, 122, ${this.shadow.shadowOpacity})`
            graphicsContext.shadowBlur = this.shadow.shadowBlur * devicePixelRatio
            graphicsContext.shadowOffsetY = this.shadow.shadowOffsetY * devicePixelRatio
        } else {
            graphicsContext.shadowColor = null
            graphicsContext.shadowBlur = null
            graphicsContext.shadowOffsetY = null
        }

        if (this.background.alpha !== 0) {
            if (this.background.constructor == Color) {
                graphicsContext.fillStyle = this.background.toString()
            } else {
                var gradient = graphicsContext.createLinearGradient(
                    this.absoluteRect.position.x * devicePixelRatio + (this.background.rect.position.x * devicePixelRatio),
                    this.absoluteRect.position.y * devicePixelRatio + (this.background.rect.position.y * devicePixelRatio),
                    this.absoluteRect.position.x * devicePixelRatio + (this.background.rect.size.width * devicePixelRatio),
                    this.absoluteRect.position.y * devicePixelRatio + (this.background.rect.size.height * devicePixelRatio)
                )
                gradient.addColorStop(0, this.background.colorA.toString())
                gradient.addColorStop(1, this.background.colorB.toString())
                graphicsContext.fillStyle = gradient
            }

            if (this.roundedCorners) {
                var x = this.absoluteRect.position.x * devicePixelRatio
                var y = this.absoluteRect.position.y * devicePixelRatio
                var width = this.rect.size.width * devicePixelRatio
                var height = this.rect.size.height * devicePixelRatio

                graphicsContext.beginPath();
                graphicsContext.moveTo(x + (this.cornerRadius.topLeft * devicePixelRatio), y);
                graphicsContext.lineTo(x + width - (this.cornerRadius.topRight * devicePixelRatio), y);
                graphicsContext.quadraticCurveTo(x + width, y, x + width, y + (this.cornerRadius.topRight * devicePixelRatio));
                graphicsContext.lineTo(x + width, y + height - (this.cornerRadius.bottomRight * devicePixelRatio));
                graphicsContext.quadraticCurveTo(x + width, y + height, x + width - (this.cornerRadius.bottomRight * devicePixelRatio), y + height);
                graphicsContext.lineTo(x + (this.cornerRadius.bottomLeft * devicePixelRatio), y + height);
                graphicsContext.quadraticCurveTo(x, y + height, x, y + height - (this.cornerRadius.bottomLeft * devicePixelRatio));
                graphicsContext.lineTo(x, y + (this.cornerRadius.topLeft * devicePixelRatio));
                graphicsContext.quadraticCurveTo(x, y, x + (this.cornerRadius.topLeft * devicePixelRatio), y);
                graphicsContext.closePath();

                graphicsContext.fill()
                if (this.borderWidth > 0) {
                    graphicsContext.strokeStyle = this.borderColor.toString()
                    graphicsContext.lineWidth = this.borderWidth
                    graphicsContext.stroke()
                }
            } else {
                graphicsContext.fillRect(
                    this.absoluteRect.position.x * devicePixelRatio,
                    this.absoluteRect.position.y * devicePixelRatio,
                    this.rect.size.width * devicePixelRatio,
                    this.rect.size.height * devicePixelRatio
                )
                if (this.borderWidth > 0) {
                    graphicsContext.strokeStyle = this.borderColor.toString()
                    graphicsContext.lineWidth = this.borderWidth
                    graphicsContext.strokeRect(
                        this.absoluteRect.position.x * devicePixelRatio,
                        this.absoluteRect.position.y * devicePixelRatio,
                        this.rect.size.width * devicePixelRatio,
                        this.rect.size.height * devicePixelRatio
                    )
                }
            }
        }
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].render(graphicsContext, this)
        }
        if (this.topMostView) {
            this.topMostView.render(graphicsContext, this)
        }
    }

    callOnce() {
        if (!this.callOnceCalled) {
            this.fireEvent('callOnce', arguments)
        }
    }

    endCallOnce() {
        this.callOnceCalled = true
    }

    removeChild(child) {
        var index = this.children.indexOf(child)
        this.children.splice(index, 1)
    }

    remove() {
        this.parent.removeChild(this)
    }
}

class TextView extends View {
    constructor(rect, settings) {
        super(rect, [new Color][0].transparent)
        this.color = settings.color || new Color(0, 0, 0, 1)
        this.text = settings.text || ''
        this.centered = settings.centered || false
        this.__textSize = settings.font && settings.font.size || 18
        this.__fontName = settings.font && settings.font.name || 'Avenir'
        this.__font = `${this.__textSize}px ${this.__fontName}`
    }

    get textSize() {
        return this.__textSize
    }

    set textSize(textSize) {
        this.__textSize = textSize
        this.font = `${this.__textSize * devicePixelRatio}px ${this.__fontName}`
    }

    get fontName() {
        return this.__fontName
    }

    set fontName(fontName) {
        this.__fontName = fontName
        this.font = `${this.__textSize * devicePixelRatio}px ${this.__fontName}`
    }

    get font() {
        return `${this.__textSize}px ${this.__fontName}`
    }

    render(graphicsContext, parent) {
        super.render(graphicsContext, parent)
        this.absolutePosition = new Point(
            (parent ? parent.absoluteRect.position.x : 0) + this.rect.position.x,
            (parent ? parent.absoluteRect.position.y : 0) + this.rect.position.y
        )
        graphicsContext.font = `${this.__textSize * devicePixelRatio}px ${this.__fontName}`
        graphicsContext.fillStyle = `rgba(${this.color.red}, ${this.color.green}, ${this.color.blue}, ${this.color.alpha})`
        graphicsContext.textBaseline = 'middle'
        if (this.centered) {
            graphicsContext.textAlign = 'center'
        } else {
            // graphicsContext.textBaseline = 'top'
            graphicsContext.textAlign = 'start'
        }
        // var textSize = new Size(graphicsContext.measureText(this.text).width, this.textSize)
        graphicsContext.fillText(
            this.text,
            (this.absoluteRect.position.x + (this.centered ? (this.rect.size.width / 2) : 0)) * devicePixelRatio,
            (this.absoluteRect.position.y + (this.rect.size.height / 2)) * devicePixelRatio,
            this.rect.size.width * devicePixelRatio
        )
    }
}

class Button extends View {
    constructor(position, text) {
        super(new Rect(position, new Size(0, 38)))
        this.__text = ''
        this.borderWidth = 1
        this.roundedCorners = true
        this.cornerRadius = {
            topLeft: 4,
            topRight: 4,
            bottomLeft: 4,
            bottomRight: 4
        }
        this.borderColor = new Color(0, 0, 0, 0.25)
        this.visualScheme = new VisualScheme()
        this.visualScheme.changeHandlers = {
            background: background => this.background = background
        }
        var upState = new VisualSchemeState('up')
        upState.addProperty('background',
            new LinearGradient(
                new Rect(
                    new Point(0, 0),
                    new Size(0, 38)
                ),
                new Color(240, 240, 240),
                new Color(218, 222, 229)
            ))//new Color(0, 187, 240)
        this.visualScheme.addState(upState)

        var downState = new VisualSchemeState('down')
        downState.addProperty('background',
            new LinearGradient(
                new Rect(
                    new Point(0, 0),
                    new Size(0, 38)
                ),
                new Color(240, 240, 240),
                new Color(232, 237, 247)
            ))//new Color(0, 168, 216)
        this.visualScheme.addState(downState)

        this.textView = new TextView(
            new Rect(new Point(0, 0), new Size(0, 38)),
            {
                color: new Color(37, 57, 91),
                text,
                font: ButtonFont,
                centered: true
            }
        )
        this.addChild(this.textView)
        this.text = text
        this.on('mousedown', () => {
            this.visualScheme.changeState('down')
        })
        this.on('mouseup', () => {
            this.visualScheme.changeState('up')
        })
        this.visualScheme.changeState('up')
    }

    get text() {
        return this.__text
    }

    set text(text) {
        this.__text = text
        var padding = 16
        system.graphicsContext.font = `${ButtonFont.size}px ${ButtonFont.name}`
        system.graphicsContext.textBaseline = 'middle'
        system.graphicsContext.textAlign = 'center'
        this.rect.size.width = graphicsContext.measureText(text).width + (padding * 2)
        this.textView.rect.size.width = this.rect.size.width
    }
}

class MultilineTextView extends View {
    constructor(rect, color, settings) {
        super(rect, color)
        this.absolutePosition = new Point(0, 0)
        this.color = settings.color || new Color(0, 0, 0, 1)
        this.__text = settings.text || ''
        this.centered = settings.centered || false
        this.__textSize = settings.font && settings.font.size || 18
        this.__fontName = settings.font && settings.font.name || 'Avenir'
        this.__font = `${this.__textSize}px ${this.__fontName}`
        this.rows = []
        this.on('resize', () => {
            this.update()
        })
        this.on('mount', () => {
            this.update()
        })
        this.on('callOnce', function () {
            console.log(...arguments)
        })
    }

    get text() {
        return this.__text
    }

    set text(text) {
        this.__text = text
        this.update()
    }

    calculateWidth(text) {
        system.graphicsContext.font = this.font
        system.graphicsContext.textBaseline = 'top'
        system.graphicsContext.textAlign = 'start'
        return system.graphicsContext.measureText(text).width
    }

    update() {
        this.rows = this.updateRows()
    }

    updateRows() {
        var rows = []
        var remainingText = this.__text
        var currentString = ''
        while (remainingText.length > 0) {
            var width = this.calculateWidth(currentString + remainingText.substring(0, 1))
            if (remainingText.substring(0, 1) == '\n') {
                rows.push(currentString)
                currentString = ''
            }
            if (width < this.rect.size.width && remainingText.length !== 0) {
                currentString += remainingText.substring(0, 1)
                remainingText = remainingText.substring(1)
            } else {
                rows.push(currentString)
                currentString = ''
            }
        }
        if (currentString.length > 0) {
            rows.push(currentString)
        }
        return rows
    }

    get textSize() {
        return this.__textSize
    }

    set textSize(textSize) {
        this.__textSize = textSize
        this.font = `${this.__textSize}px ${this.__fontName}`
    }

    get fontName() {
        return this.__fontName
    }

    set fontName(fontName) {
        this.__fontName = fontName
        this.font = `${this.__textSize}px ${this.__fontName}`
    }

    get font() {
        return this.__font
    }

    render(graphicsContext, parent) {
        super.render(graphicsContext, parent)
        this.absolutePosition = new Point(
            (parent ? parent.absoluteRect.position.x : 0) + this.rect.position.x,
            (parent ? parent.absoluteRect.position.y : 0) + this.rect.position.y
        )
        graphicsContext.font = `${this.__textSize * devicePixelRatio}px ${this.__fontName}`
        graphicsContext.fillStyle = `rgba(${this.color.red}, ${this.color.green}, ${this.color.blue}, ${this.color.alpha})`
        if (this.centered) {
            graphicsContext.textBaseline = 'middle'
            graphicsContext.textAlign = 'center'
        } else {
            graphicsContext.textBaseline = 'top'
            graphicsContext.textAlign = 'start'
        }
        var lineHeight = this.textSize + 8
        for (var i = 0; i < this.rows.length; i++) {
            if (this.absoluteRect.contains(new Point(this.absoluteRect.position.x, this.absoluteRect.position.y + (i * lineHeight) + lineHeight))) {
                graphicsContext.fillText(
                    this.rows[i],
                    this.absoluteRect.position.x * devicePixelRatio,
                    (this.absoluteRect.position.y + (i * lineHeight)) * devicePixelRatio,
                    this.rect.size.width * devicePixelRatio
                )
            }
        }
    }
}

class ModalOverlay extends View {
    constructor() {
        super(system.rootView.rect, new Color(0, 0, 0, 0.5))
    }
}

class ButtonBar extends View {
    constructor(height) {
        super(new Rect(new Point(0, 0), new Size(0, 0)), new Color(191, 191, 191, 1))
        this.height = height || 72
        this.on('mount', parent => {
            this.rect = new Rect(new Point(0, parent.rect.size.height - this.height), new Size(parent.rect.size.width, this.height))
        })
    }

    addButton(button) {
        // position adjust
        this.addChild(button)
    }
}

class AlertView extends ModalOverlay {
    constructor(text) {
        super()
        this.windowSize = new Size(600, 300)
        this.window = new View(
            new Rect(
                new Point(
                    (this.rect.size.width / 2) - this.windowSize.width / 2,
                    (this.rect.size.height / 2) - this.windowSize.height / 2
                ),
                this.windowSize
            ), new Color(255, 255, 255, 1)
        )
        this.buttonBar = new ButtonBar(38)
        var textPadding = 18
        this.textView = new MultilineTextView(
            new Rect(
                new Point(textPadding, textPadding),
                new Size(
                    this.window.rect.size.width - (textPadding * 2),
                    this.window.rect.size.height - this.buttonBar.height - (textPadding * 2)
                )
            ), new Color(255, 255, 255, 1), {
                color: new Color(0, 0, 0, 1),
                text
            }
        )
        let closeButton = new Button(new Point(0, 0), 'Stäng')
        closeButton.on('mouseup', () => {
            this.remove()
            this.fireEvent('close')
        })
        this.buttonBar.addChild(closeButton)
        this.window.addChild(this.buttonBar)
        this.window.addChild(this.textView)
        this.addChild(this.window)
    }
}

class DraggableAreaView extends View {
    constructor(rect, color) {
        super(rect, color)
        this.targetView = null
        this.moveOffset = new Point(0, 0)
        this.on('mousedown', (position, view) => {
            this.moveOffset = position.subtract(this.absoluteRect.position)
            system.rootView.currentDraggable = this
        })
    }

    set target(targetView) {
        this.targetView = targetView
    }

    get target() {
        return this.targetView
    }
}

class VisualScheme extends EventEmitter {
    constructor() {
        super()
        this.states = {}
        this.changeHandlers = {}
    }

    addState(state) {
        this.states[state.name] = state
    }

    changeState(stateName) {
        if (this.states[stateName]) {
            var state = this.states[stateName]
            var properties = state.properties
            for (var property in properties) {
                if (this.changeHandlers[property]) {
                    this.changeHandlers[property](properties[property])
                }
            }
        }
    }
}

class VisualSchemeState {
    constructor(name) {
        this.name = name
        this.properties = {}
    }

    addProperty(property, value) {
        this.properties[property] = value
    }
}

class LinearGradient {
    constructor(rect, colorA, colorB) {
        this.rect = rect
        this.colorA = colorA
        this.colorB = colorB
    }
}

class WindowButtonGroup extends View {
    constructor(buttons) {
        super()
        this.buttons = buttons || ['closeButton']
        var buttonSize = new Size(42, 42)
        for (var i = 0; i < this.buttons.length; i++) {
            var buttonView = new ImageView(new Rect(new Point(i * buttonSize.width, 0), buttonSize), 'resources/cross.png')
            buttonView.borderWidth = 1
            this.addChild(buttonView)
            if (i == this.buttons.length - 1) {
                buttonView.roundedCorners = true
                buttonView.cornerRadius.topRight = 8
            }
            switch (this.buttons[i]) {
                case 'closeButton':
                    this.closeButton = buttonView
                    buttonView.on('mousedown', () => this.visualScheme.changeState('closeButtonPressed'))
                    buttonView.on('mouseup', () => this.fireEvent('requestedClose'))
                    break;
                case 'minimizeButton':
                    this.minimizeButton = buttonView
                    buttonView.on('mouseup', () => this.fireEvent('requestedMinimize'))
                    break;
                case 'maximizeButton':
                    this.maximizeButton = buttonView
                    buttonView.on('mouseup', () => this.fireEvent('requestedMaximize'))
                    break;

                default:
                    break;
            }
        }
        this.roundedCorners = true
        this.cornerRadius.topRight = 8
        this.rect.size = new Size(buttonSize.width * this.buttons.length, buttonSize.height)
        this.visualScheme = new VisualScheme()
        this.visualScheme.changeHandlers = {
            closeButtonBackground: background => this.closeButton.background = background
        }
        var activeState = new VisualSchemeState('active')
        activeState.addProperty('closeButtonBackground',
            new LinearGradient(new Rect(new Point(0, 0), new Size(0, buttonSize.height)),
                new Color(232, 64, 64),
                new Color(206, 28, 28)
            )
        )
        this.visualScheme.addState(activeState)

        var inactiveState = new VisualSchemeState('inactive')
        inactiveState.addProperty('closeButtonBackground',
            new LinearGradient(new Rect(new Point(0, 0), new Size(0, buttonSize.height)),
                new Color(239, 103, 103),
                new Color(204, 75, 75)
            )
        )
        this.visualScheme.addState(inactiveState)

        var closeButtonPressedState = new VisualSchemeState('closeButtonPressed')
        closeButtonPressedState.addProperty('closeButtonBackground',
            new LinearGradient(new Rect(new Point(0, 0), new Size(0, buttonSize.height)),
                new Color(173, 22, 22),
                new Color(201, 54, 54)
            )
        )
        this.visualScheme.addState(closeButtonPressedState)
        this.visualScheme.changeState('active')
    }

    get active() {
        return this.__active
    }

    set active(active) {
        this.__active = active
        this.visualScheme.changeState(active ? 'active' : 'inactive')
    }
}

class WindowView extends View {
    constructor(rect, title, closeButton) {
        super(rect, null, true)
        this.visualScheme = new VisualScheme()
        this.visualScheme.changeHandlers = {
            titlebarColor: titlebarColor => this.titleBar.background = titlebarColor,
            shadowOpacity: shadowOpacity => this.shadow.shadowOpacity = shadowOpacity,
            shadowBlur: shadowBlur => this.shadow.shadowBlur = shadowBlur,
            titleTextColor: color => this.titleTextView.color = color
        }
        this.titleBar = new DraggableAreaView(new Rect(new Point(0, 0), new Size(this.rect.size.width, 42)))
        this.titleBar.roundedCorners = true
        this.titleBar.cornerRadius.topLeft = 8
        this.titleBar.cornerRadius.topRight = 8
        this.titleBar.borderWidth = 1
        this.titleTextView = new TextView(new Rect(new Point(14, 0), new Size(this.rect.size.width, 42)), {
            color: new Color(37, 57, 91),
            centered: true,
            text: title
        })
        // var closeButton = new ImageView(new Rect(new Point(this.titleBar.rect.size.width - 42, 0), new Size(42, 42)), 'cross.png')
        // closeButton.on('mouseup', () => this.fireEvent('requestedClose'))
        // closeButton.background = new LinearGradient(new Rect(new Point(0, 0), new Size(0, 42)), new Color(232, 64, 64), new Color(206, 28, 28))
        // closeButton.borderWidth = 1

        this.titleBar.target = this
        this.contentView = new View(new Rect(new Point(0, 42), new Size(this.rect.size.width, this.rect.size.height - 42)), new Color(255, 255, 255, 1))
        this.contentView.borderWidth = 1

        var activeState = new VisualSchemeState('active')
        activeState.addProperty(
            'titlebarColor',
            new LinearGradient(
                new Rect(
                    new Point(0, 0),
                    new Size(0, 42)
                ),
                new Color(240, 240, 240),
                new Color(218, 222, 229)
            )
        )
        activeState.addProperty('shadowOpacity', 0.25)
        activeState.addProperty('shadowBlur', 32)
        activeState.addProperty('titleTextColor', new Color(37, 57, 91))
        this.visualScheme.addState(activeState)

        var inactiveState = new VisualSchemeState('inactive')
        inactiveState.addProperty('titlebarColor', new Color(250, 250, 250))
        inactiveState.addProperty('shadowOpacity', 0.1)
        inactiveState.addProperty('shadowBlur', 16)
        inactiveState.addProperty('titleTextColor', new Color(173, 186, 209))
        this.visualScheme.addState(inactiveState)

        this.titleBar.addChild(this.titleTextView)

        if (closeButton) {
            this.windowButtonGroup = new WindowButtonGroup(['closeButton'])
            this.windowButtonGroup.rect.position = new Point(this.titleBar.rect.size.width - this.windowButtonGroup.size.width, 0)
            this.windowButtonGroup.on('requestedClose', () => this.fireEvent('requestedClose'))
            this.titleBar.addChild(this.windowButtonGroup)
        }
        // this.titleBar.addChild(closeButton)
        this.addChild(this.titleBar)
        this.addChild(this.contentView)
        this.__active = false
        this.roundedCorners = true
        this.cornerRadius.topLeft = 8
        this.cornerRadius.topRight = 8
        this.cornerRadius.bottomLeft = 8
        this.cornerRadius.bottomRight = 8

        this.contentView.roundedCorners = true
        this.contentView.cornerRadius.bottomLeft = 8
        this.contentView.cornerRadius.bottomRight = 8
    }

    get active() {
        return this.__active
    }

    set active(active) {
        super.active = active
        this.__active = active
        this.visualScheme.changeState(active ? 'active' : 'inactive')
        if (this.windowButtonGroup) {
            this.windowButtonGroup.active = active
        }
    }
}

class UIWindow {
    constructor(rect, title, closable) {
        this.title = title
        this.closable = closable !== undefined ? closable : true
        this.view = new WindowView(rect, this.title, this.closable)
        this.view.on('requestedClose', () => this.close())
        this.__active = false
        this.view.on('mousedown', () => {
            this.active = true
        })
        this.windowManager = null
    }

    get active() {
        return this.__active
    }

    set active(active) {
        if (this.__active !== active) {
            if (active && this.windowManager.activeWindow !== this) {
                this.windowManager.blurAll()
                this.view.top()
                this.windowManager.activeWindow = this
            }
            this.__active = active
            this.view.active = active
        }
    }

    close() {
        this.view.remove()
    }
}

class WindowManager {
    constructor() {
        this.windows = []
        this.activeWindow = null
        this.defaultWindowPosition = new Point(175, 175)
    }

    blurAll() {
        for (var i = 0; i < this.windows.length; i++) {
            this.windows[i].active = false
        }
    }

    windowAtPosition(point) {
        for (var i = 0; i < this.windows.length; i++) {
            var window = this.windows[i]
            if (window.view.rect.position.equals(point)) {
                return window
            }
        }
        return null
    }

    createWindow(settings) {
        var settings = settings || {}
        var startPosition = settings.position || this.defaultWindowPosition
        while (this.windowAtPosition(startPosition)) {
            startPosition = startPosition.add(new Point(32, 32))
        }
        var window = new UIWindow(new Rect(startPosition, settings.size || new Size(400, 300)), settings.title || 'Namnlöst fönster', settings.closable !== undefined ? settings.closable : true)
        window.windowManager = this
        system.rootView.addChild(window.view)
        this.windows.push(window)
        window.active = true
        return window
    }
}

function implementDraggable(view) {
    view.currentDraggable = null
    view.on('mousemove', (position, view) => {
        if (view.currentDraggable) {
            var target = view.currentDraggable.target
            var containerRect = new Rect(system.rootView.rect.position.subtract(new Point(target.rect.size.width - 42, 0)), system.rootView.rect.size.subtract(new Size(-target.rect.size.width + (42 * 2), 42)))
            // console.log(containerRect)
            var movePosition = position.subtract(view.currentDraggable.moveOffset)
            if (movePosition.x <= containerRect.position.x) { movePosition.x = containerRect.position.x }
            if (movePosition.y <= containerRect.position.y) { movePosition.y = containerRect.position.y }
            if (movePosition.x >= containerRect.size.width) { movePosition.x = containerRect.size.width }
            if (movePosition.y >= containerRect.size.height) { movePosition.y = containerRect.size.height }
            if (containerRect.contains(movePosition)) {
                target.position = movePosition
            }
        }
    })
    view.on('mouseup', position => {
        view.currentDraggable = null
    })
}

class ImageView extends View {
    constructor(rect, source) {
        super(rect, new Color(0, 0, 0, 0))
        this.imageElement = document.createElement('img')
        this.imageElement.setAttribute('src', source)
        this.imageElement.setAttribute('width', this.rect.size.width)
        this.imageElement.setAttribute('height', this.rect.size.height)
    }

    render(graphicsContext, parent) {
        super.render(graphicsContext, parent)
        this.absolutePosition = new Point(
            (parent ? parent.absoluteRect.position.x : 0) + this.rect.position.x,
            (parent ? parent.absoluteRect.position.y : 0) + this.rect.position.y
        )
        graphicsContext.drawImage(
            this.imageElement,
            this.absoluteRect.position.x * devicePixelRatio,
            this.absoluteRect.position.y * devicePixelRatio,
            this.rect.size.width * devicePixelRatio,
            this.rect.size.height * devicePixelRatio
        )
    }
}

class Typer {
    constructor() {
        this.buffer = ''
        this.shift = false
        this.capsLock = false
    }

    char(char) {
        return (this.shift || this.capsLock ? char : char.toLowerCase())
    }

    down(event) {
        var keyCode = event.keyCode
        this.capsLock = event.getModifierState("CapsLock")
        if (48 <= keyCode && keyCode <= 57) {
            if (this.shift) {
                var uRow = `=!"#€%&/()`
                this.buffer += uRow[keyCode - 48]
            } else {
                this.buffer += String.fromCharCode(keyCode)
            }
        } else if (65 <= keyCode && keyCode <= 90 || 48 <= keyCode && keyCode <= 57) {
            this.buffer += (this.shift || this.capsLock ? String.fromCharCode(keyCode) : String.fromCharCode(keyCode).toLowerCase())
        } else {
            switch (keyCode) {
                case 8:
                    this.buffer = this.buffer.substring(0, this.buffer.length - 1)
                    break;
                case 16:
                    this.shift = true
                    break;
                case 219:
                    this.buffer += this.char('Å')
                    break;
                case 222:
                    this.buffer += this.char('Ä')
                    break;
                case 186:
                    this.buffer += this.char('Ö')
                    break;
                case 32:
                    this.buffer += ' '
                    break;
                case 187:
                    this.buffer += '+'
                    break;
                case 189:
                    this.buffer += '-'
                    break;
                case 188:
                    this.buffer += ','
                    break;
                case 190:
                    this.buffer += '.'
                    break;

                default:
                    // this.buffer += event.key
                    // console.log(keyCode, String.fromCharCode(keyCode))
                    break;
            }
        }
        return this.buffer
    }

    up(event) {
        var keyCode = event.keyCode
        switch (keyCode) {
            case 16:
                this.shift = false
                break;

            default:
                break;
        }
        return this.buffer
    }
}

class TextBox extends View {
    constructor(position, width) {
        var height = 38
        super(new Rect(position, new Size(width, height)), new Color(255, 255, 255, 1))
        this.height = height
        this.padding = 12
        this.__textContent = ''
        this.fontSize = 18
        this.fontName = 'Avenir'
        this.__active = false
        this.cursorVisible = false
        this.textWidth = 0
        this.blinkIntervalRef = null
        this.pauseTimeoutRef = null
        this.borderWidth = 1
        this.typer = new Typer()
        this.on('mousedown', () => {
            this.active = true
        })
        this.on('keydown', keyCode => {
            this.textContent = this.typer.down(keyCode)
            this.fireEvent('change', [this.textContent])
            this.pauseBlink(300)
        })
        this.on('keyup', keyCode => {
            // this.textContent = 
            this.typer.up(keyCode)
        })
        this.roundedCorners = true
        this.cornerRadius = {
            topLeft: 4,
            topRight: 4,
            bottomLeft: 4,
            bottomRight: 4
        }
    }

    get active() {
        return this.__active
    }

    set active(active) {
        if (active !== this.__active) {
            super.active = active
            this.__active = active
            if (active) {
                if (system.activeInputView) {
                    system.activeInputView.active = false
                }
                system.activeInputView = this
                this.startBlinking()
            } else {
                this.stopBlinking()
            }
        }
    }

    startBlinking() {
        this.cursorVisible = true
        this.blinkIntervalRef = setInterval(() => {
            this.cursorVisible = !this.cursorVisible
        }, 600)
    }

    stopBlinking() {
        this.cursorVisible = false
        clearInterval(this.blinkIntervalRef)
    }

    pauseBlink(interval) {
        if (this.pauseTimeoutRef !== null) {
            clearInterval(this.pauseTimeoutRef)
            this.pauseTimeoutRef = null
        }
        this.cursorVisible = true
        clearInterval(this.blinkIntervalRef)
        this.pauseTimeoutRef = setTimeout(() => {
            this.startBlinking()
        }, interval)
    }

    get textContent() {
        return this.__textContent
    }

    set textContent(textContent) {
        this.__textContent = textContent
        this.typer.buffer = this.__textContent
        this.textWidth = this.calculateWidth(this.__textContent)
    }

    calculateWidth(text) {
        graphicsContext.font = `${this.fontSize * devicePixelRatio}px ${this.fontName}`
        system.graphicsContext.textBaseline = 'middle'
        system.graphicsContext.textAlign = 'start'
        var width = system.graphicsContext.measureText(text).width
        return width
    }

    render(graphicsContext, parent) {
        super.render(graphicsContext, parent)
        this.absolutePosition = new Point(
            (parent ? parent.absoluteRect.position.x : 0) + this.rect.position.x,
            (parent ? parent.absoluteRect.position.y : 0) + this.rect.position.y
        )
        graphicsContext.font = `${this.fontSize * devicePixelRatio}px ${this.fontName}`
        graphicsContext.textBaseline = 'middle'
        graphicsContext.textAlign = 'start'
        graphicsContext.fillStyle = `rgba(0, 0, 0, 1)`
        graphicsContext.fillText(
            this.textContent,
            (this.absoluteRect.position.x + this.padding) * devicePixelRatio,
            (this.absoluteRect.position.y + (this.rect.size.height / 2)) * devicePixelRatio,
            this.rect.size.width * devicePixelRatio
        )
        if (this.cursorVisible) {
            graphicsContext.fillRect(
                (((this.absoluteRect.position.x + this.padding) * devicePixelRatio) + this.textWidth) + 1,
                (this.absoluteRect.position.y + 8) * devicePixelRatio,
                (1) * devicePixelRatio,
                (this.rect.size.height - (8) * 2) * devicePixelRatio
            )
        }
    }
}

const system = new System()
canvas.requestPointerLock()
var framesRendered = 0
const update = () => {
    system.graphicsContext.clearRect(0, 0, system.containerSize.width, system.containerSize.height)
    system.rootView.render(system.graphicsContext, null)
    if (desiredFrameRate >= 60) {
        requestAnimationFrame(update)
    } else {
        setTimeout(() => {
            requestAnimationFrame(update)
        }, 1000 / desiredFrameRate)
    }
    framesRendered++
}

// var lastValue = 0
// setInterval(() => {
//     var frameRate = (framesRendered - lastValue)
//     console.log(frameRate)
//     lastValue = framesRendered
// }, 1000)


var lagInterval = null
function lag(base, variance) {
    if (lagInterval == null) {
        var base = base || 20
        var variance = variance || 15
        updateFrameRate = () => {
            desiredFrameRate = base + (variance / 2) - (Math.random() * variance)
        }
        updateFrameRate()
        lagInterval = setInterval(updateFrameRate, 250)
    }
}

function unlag() {
    clearInterval(lagInterval)
    lagInterval = null
    desiredFrameRate = 60
}

function pr(pr) {
    devicePixelRatio = pr
    system.init(getContainerSize())
    resize(system.containerSize)
    return `devicePixelRatio: ${devicePixelRatio}`
}

addEventListener('load', () => {
    system.init(getContainerSize())
    resize(system.containerSize)
    addEventListener('resize', () => {
        // resize(getContainerSize())
    })
    addEventListener('mousedown', event => {
        system.rootView.fireEvent('mousedown', [new Point(event.clientX, event.clientY), system.rootView])
    })
    addEventListener('mouseup', event => {
        system.rootView.fireEvent('mouseup', [new Point(event.clientX, event.clientY), system.rootView])
    })
    addEventListener('mousemove', event => {
        system.rootView.fireEvent('mousemove', [new Point(event.clientX, event.clientY), system.rootView])
    })
    addEventListener('keydown', event => {
        system.rootView.fireEvent('keydown', [event, system.rootView])
    })
    addEventListener('keyup', event => {
        system.rootView.fireEvent('keyup', [event, system.rootView])
    })
    implementDraggable(system.rootView)
    init(system)
    update()
    lag()
})