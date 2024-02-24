import type { NextApiRequest, NextApiResponse } from 'next'
import { IMAGES } from '@/utils/image-paths'
import { validateMessage, validateMsgWithNeynar } from '@/validate'
import { TSignedMessage, TUntrustedData, TUserProfileNeynar } from '@/types'
import { generateFarcasterFrame, SERVER_URL } from '@/utils/generate-frames'
import {
  calculateIfWinningOrNot,
  getImageFromQuestionId,
  getQuestionFromId,
} from '@/utils/database-operations'
import {
  getChannelFromCastHash,
  getIfUserIsInChannel,
} from '@/utils/neynar-api'
import { HANDLE_QUESTION } from '@/utils/question'

const QUESTION_ID = parseInt(process.env.QUESTION_ID || '')

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const signedMessage = req.body as TSignedMessage

  const reqId = req.query.data
  console.log('request query: ', reqId)

  const isMessageValid = await validateMsgWithNeynar(
    signedMessage.trustedData?.messageBytes
  )

  if (!isMessageValid) {
    return res.status(400).json({ error: 'Invalid message' })
  }

  const ud: TUntrustedData = signedMessage.untrustedData

  let html: string = ''
  let statusCode: number = 200
  let locationHeader: string = ''
  let userIsInChannel: TUserProfileNeynar | null | undefined = null

  const response = res.status(statusCode).setHeader('Content-Type', 'text/html')

  //let castHash = ud.castId.hash
  let castHash = '0x7aadf31bcdd0adfe41e593c5bc6c32bb81118471' //cryptostocks cast
  //let castHash = '0x06eb7e9a70fdae0fa81fcf13580860ab04167e9d' //skininthegame cast
  //let castHash = '0x70ba5f9ceb1951de0aef3ffc6bcc60c1d8c10819' //Neynar channel cast

  let channel = await getChannelFromCastHash(castHash)
  if (!channel) channel = 'skininthegame'
  console.log(channel, 'wats channel?')

  switch (reqId) {
    case 'start':
      userIsInChannel = await getIfUserIsInChannel(channel, ud.fid)

      if (1 === 1) {
        //if (userIsInChannel?.fid) {

        //TODO send in question here
        const question = await getQuestionFromId(QUESTION_ID)
        html = generateFarcasterFrame(
          `${SERVER_URL}/${IMAGES.question}`,
          'question',
          question
        )
      } else {
        html = generateFarcasterFrame(
          `${SERVER_URL}/${IMAGES.be_a_follower}`,
          'error-be-a-follower'
        )
      }
      break
    case 'question':
      const question = await getQuestionFromId(QUESTION_ID)
      if (channel && question) {
        html = await HANDLE_QUESTION(ud, channel)
      } else {
        html = generateFarcasterFrame(
          `${SERVER_URL}/${IMAGES.expired}`,
          'leaderboard'
        )
      }
      break
    case 'error-be-a-follower':
      locationHeader = `https://warpcast.com/~/channel/${channel}`
      response.redirect(302, locationHeader)
      break
    case 'leaderboard':
      locationHeader = `${process.env.NGROK_OR_HOSTED_SERVER_URL}`
      response.redirect(302, locationHeader)
      break
    case 'correct-or-incorrect':
      if (ud.buttonIndex === 1) {
        //calculate if winning or not here
        html = await calculateIfWinningOrNot(channel)
      } else {
        locationHeader = `https://warpcast.com/~/channel/liquality`
        response.redirect(302, locationHeader)
      }

      break
    default:
      html = generateFarcasterFrame(
        `${SERVER_URL}/${IMAGES.question}`,
        'question'
      )
      break
  }
  return response.send(html)
}
