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
    }
  }

  //------------------------------------------------------------------//
  // Events
  window.addEventListener('connect-click', () => {
    blockapi.connect(blockmetadata, connected, disconnected)
  })

  window.addEventListener('disconnect-click', () => {
    delete state.account
    disconnected()
  })

  //------------------------------------------------------------------//
  // Properties
  const nft = blockapi.contract('nft')
  const state = { connected: false }

  //------------------------------------------------------------------//
  // Initialize
  window.doon('body')
  blockapi.startSession(blockmetadata, connected, disconnected, true)
})()