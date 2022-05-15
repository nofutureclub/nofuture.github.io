(() => {
  //------------------------------------------------------------------//
  // Functions
  const toggle = function(show, hide, init) {
    Array
      .from(document.querySelectorAll(init))
      .forEach(connector => connector.style.display = 'none')

  	Array
      .from(document.querySelectorAll(show))
      .forEach(connector => connector.style.display = 'block')
    
    Array
      .from(document.querySelectorAll(hide))
      .forEach(connector => connector.style.display = 'none')
  }

  const isHolder = async function() {
  	const accounts = await window.ethereum.request({ method: 'eth_accounts' })
    for (const account of accounts) {
      const balance = parseInt(await blockapi.read(nft, 'balanceOf', account))
      if (balance) return true
    }
    return false
  }

  const holder = async function(session) {
    toggle('.holder', '.nonholder', '.holder-init')
    name.value = state.account
  }

  const nonholder = async function(session) {
  	toggle('.nonholder', '.holder', '.holder-init')
  }

  const connected = async function(newstate, session) {
    Object.assign(state, newstate, { connected: true })
    //if first time connecting
    if (!session) {
      notify('success', 'Wallet connected')
    }
    toggle('.connected', '.disconnected', '.connection-init')
    //check nfts
    if (await isHolder()) {
      await holder(session)
    } else {
      const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop),
      });
      
      if (params.debug === 'nofuturedev') {
      	await holder(session)
      } else {
      	await nonholder(session)
      }
    }
  }

  const disconnected = function(e, session) {
    if (e?.message) {
      notify('error', e.message)
    } else {
      //if first time connecting
      if (!session) {
        notify('success', 'Wallet disconnected')
      }
      toggle('.disconnected', '.connected', '.connection-init')
      name.value = ''
    }
  }

  const toElement = function(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  const toRelative = function(date) {
    
    const diff = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diff < 60) {
      return `${diff}s ago`
    } else if (diff < (60 * 60)) {
      return `${Math.ceil(diff/60)}m ago`
    } else if (diff < (60 * 60 * 24)) {
      return `${Math.ceil(diff/(60 * 60))}h ago`
    } else if (diff < (60 * 60 * 24 * 7)) {
      return `${Math.ceil(diff/(60 * 60 * 24))}d ago`
    } else if (diff < (60 * 60 * 24 * 7 * 4)) {
      return `${Math.ceil(diff/(60 * 60 * 24 * 7))}w ago`
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    return `${months[date.getMonth()]} ${date.getDate()}`
  }

  const loadAnswers = async function() {
    const response = await fetch(
      [
        'https://sheets.googleapis.com/v4/spreadsheets/',
        '16NaNlYArZ6v8COt8ncYZADLpfqNon4nQpThel-T5mSA/values/',
        '1?alt=json&key=AIzaSyAp5gMqvuRoIfBYXdWLyKhw1mRatpzqva4'
      ].join('')
    )
    const container = document.querySelector('div.answers')
    container.innerHTML = '<div class="loading">Loading Answers...</div>'
    const json = await response.json()
    json.values.shift()
    container.innerHTML = ''
    
    for (const row of json.values) {
      if (!row[0]?.length || !row[1]?.length || !row[2]?.length || row[3] === 'hide') {
        continue;
      }

      const answer = toElement(tplAnswer
        .replace('{AUTHOR}', row[1].indexOf('0x') !== 0 ? row[1]: [
            row[1].substr(0, 6),
            row[1].substr(row[1].length - 4)
          ].join('...')
        )
        .replace('{DATE}', toRelative(new Date(row[0])))
        .replace('{MESSAGE}', row[2])
      )

      container.appendChild(answer)
    }
  }

  //------------------------------------------------------------------//
  // Properties
  const nft = blockapi.contract('nft')
  const state = { connected: false }

  const form = document.getElementById('google-form')
  const frame = document.getElementById('google-frame')
  const submit = form.querySelector('form button')
  const name = document.getElementById('input-address')
  const message = form.querySelector('form textarea')
  const tplAnswer = document.getElementById('tpl-answer').innerHTML

  let loaded = false
  let submitted = false

  //------------------------------------------------------------------//
  // Events
  window.addEventListener('connect-click', () => {
    blockapi.connect(blockmetadata, connected, disconnected)
  })

  window.addEventListener('disconnect-click', () => {
    delete state.account
    disconnected()
  })

  message.addEventListener('keyup', () => setTimeout(() => {
    submit.disabled = true
    if (!submitted && name.value.length && message.value.length) {
      submit.disabled = false
    }
  }, 0))

  form.addEventListener('submit', () => {
    submitted = true
    submit.disabled = true
    submit.innerText = 'Working...'
  })
  
  frame.addEventListener('load', () => {
    if (loaded++ > 0) {
      form.parentElement.removeChild(form)
      notify('success', 'Message Sent!')
      loadAnswers()
    }
  })

  //------------------------------------------------------------------//
  // Initialize
  window.doon('body')
  blockapi.startSession(blockmetadata, connected, disconnected, true)
  loadAnswers()
})()