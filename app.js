let APP_ID = "fff27536c41b44f6add8a1659bc2a8da";
// const uniqId = require('uniqid'); not working ?


let token = null;
// let uid = uniqId();
let uid = String(Math.floor(Math.random() * 100000))

let client;
let channel;

// 
let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

// if roomId is not available redirect to lobby page
if (!roomId) {
    window.location = 'lobby.html'
}


let localStream;
let remoteStream;
let peerConnection;

// stun server
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
        }
    ]
}


let init = async () => {
    // create client object
    client = await AgoraRTM.createInstance(APP_ID, { enableLogUpload: false })
    // login 
    await client.login({ uid, token })

    //create channel  // index.html?room=2135
    channel = client.createChannel(roomId)  //we have only one channel hence there is no requirement for large number of room ids for now
    // join the channel
    await channel.join()

    // event listener for listening to the event of someone joining the channel
    channel.on('MemberJoined', handleUserJoined)

    // in case user left
    channel.on('MemberLeft', handleUserLeft)

    // event listener to listen to the message we get from other peer
    client.on('MessageFromPeer', handleMessageFromPeer)


    // to get permission for audio/video
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    document.getElementById('user-1').srcObject = localStream

    // createOffer()
}

// handle user left
let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('smallFrame')
}


// function to handle the message from other peer
let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text)
    // console.log('Message:', message)

    // create the answer when we get the offer
    if (message.type === 'offer') {
        createAnswer(MemberId, message.offer);
    }

    // add the answer to the remote description when we get the answer from other peer
    if (message.type === 'answer') {
        addAnswer(message.answer);
    }

    // 
    if (message.type === 'candidate') {
        //
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}


// handle the new user joined
let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId)
    createOffer(MemberId)
}


// function to create peer connection 
let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)  // store all the info between peers

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream  // to get permission for audio/video
    document.getElementById('user-2').style.display = 'block'     // add the second user block only when other user has joined the channel
    
    //
    document.getElementById('user-1').classList.add('smallFrame')

    // if local stream is not created ......
    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        document.getElementById('user-1').srcObject = localStream
    }


    // add local tracks (audio/video) to the peerConnection
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })


    // listen to the tracks of remote peer
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }


    // create ice candidates
    peerConnection.onicecandidate = async (event) => {
        // check if the current event is an ice candidate
        if (event.candidate) {
            // console.log('New Ice candidate:', event.candidate)
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
        }
    }
}

// to create offer
let createOffer = async (MemberId) => {
    // peerConnection = new RTCPeerConnection(servers)  // store all the info between peers

    // remoteStream = new MediaStream()
    // document.getElementById('user-2').srcObject = remoteStream  // to get permission for audio/video


    // // if local stream is not created ......
    // if (!localStream) {
    //     localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    //     document.getElementById('user-1').srcObject = localStream
    // }


    // // add local tracks (audio/video) to the peerConnection
    // localStream.getTracks().forEach((track) => {
    //     peerConnection.addTrack(track, localStream)
    // })


    // // listen to the tracks of remote peer
    // peerConnection.ontrack = (event) => {
    //     event.streams[0].getTracks().forEach((track) => {
    //         remoteStream.addTrack(track)
    //     })
    // }


    // // create ice candidates
    // peerConnection.onicecandidate = async (event) => {
    //     // check if the current event is an ice candidate
    //     if (event.candidate) {
    //         // console.log('New Ice candidate:', event.candidate)
    //         client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
    //     }
    // }


    //invoke create peer connection function before sending offer
    await createPeerConnection(MemberId)

    // 
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    // console.log('Offer:', offer)

    // send message to the peer having newly joined member
    // client.sendMessageToPeer({text:'Hi...'},MemberId) 
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId)
}

//
let createAnswer = async (MemberId, offer) => {
    //invoke create peer connection function before sending answer
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId)
}

//
let addAnswer = async (answer) => {
    // if we currently don't have a remote description, set this
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer)
    }
}

//
let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}


// camera button functionality
let cameraBtnFunc = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled=false
        document.getElementById('camera-btn').style.backgroundColor='red'
    }else{
        videoTrack.enabled=true
        document.getElementById('camera-btn').style.backgroundColor='blueviolet'
    }
}

// audio btn functionality
let audioBtnFunc = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled=false
        document.getElementById('mic-btn').style.backgroundColor='red'
    }else{
        audioTrack.enabled=true
        document.getElementById('mic-btn').style.backgroundColor='blueviolet'
    }
}

// to account for the situation when a user closes a window ......*****
window.addEventListener('beforeunload', leaveChannel)

// on event of camera btn click
document.getElementById('camera-btn').addEventListener('click',cameraBtnFunc)

//
document.getElementById('mic-btn').addEventListener('click',audioBtnFunc)


init()