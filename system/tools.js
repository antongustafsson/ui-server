function randomText(length) {
    c = () => String.fromCharCode(65 + Math.round(Math.random() * (90 - 65)))
    return new Array(length).fill(null).map(c).join('')
}

function alert(text) {
    var alertView = new AlertView(text)
    system.rootView.addChild(alertView)
    system.windowManager.blurAll()
    system.blurInput()
    return new Promise((resolve, reject) => {
        alertView.on('close', (ok) => {
            resolve()
        })
    })
}

function openTextWindow(title, text) {
    var textWindow = system.windowManager.createWindow({
        position: null,
        size: new Size(600, 412),
        title
    })
    var textView = new MultilineTextView(
        new Rect(new Point(0, 0), new Size(textWindow.view.contentView.rect.size.width, textWindow.view.contentView.rect.size.height)),
        new Color(255, 255, 255, 1), {
            color: new Color(0, 0, 0, 1),
            text
        })
    textWindow.view.contentView.addChild(textView)
}

function openTestWindow() {
    var textWindow = system.windowManager.createWindow({
        position: null,
        size: new Size(600, 412),
        title: 'Testfönster'
    })
    var textView = new MultilineTextView(
        new Rect(new Point(16, 16), new Size(textWindow.view.contentView.rect.size.width - (16 * 2), textWindow.view.contentView.rect.size.height - 48 - (16 * 2))),
        new Color(255, 255, 255, 1), {
            color: new Color(0, 0, 0, 1),
            text: ''
        })
    var textBox = new TextBox(new Point(16, textWindow.view.contentView.rect.size.height - 48), textWindow.view.contentView.rect.size.width - 128 - 16)
    submit = () => {
        var result
        try{
            result = eval(textBox.textContent)
        }catch(error){
            result = error
        }
        textView.text += `> ${result}\n`
        textBox.textContent = ''
    }
    textBox.on('keyup', event => {
        var { keyCode } = event
        if(keyCode == 13){
            submit()
        }
    })
    textBox.textContent = ''
    var submitButton = new Button(new Point(textWindow.view.contentView.rect.size.width - 112, textWindow.view.contentView.rect.size.height - 48), 'Lägg till')
    submitButton.on('mouseup', submit)
    textWindow.view.contentView.addChild(textView)
    textWindow.view.contentView.addChild(textBox)
    textWindow.view.contentView.addChild(submitButton)
}