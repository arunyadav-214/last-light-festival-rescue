window.LAST_LIGHT_DATA = {
  durationMs: 18 * 60 * 1000,
  districts: [
    {
      name: "Lantern Market",
      title: "Recover the ember word",
      story: "The market’s emergency lanterns are intact, but the ignition phrase was split across vendor ledgers. Reconstruct the one word that can wake the district grid.",
      prompt: "Combine your private clues. What five-letter word belongs in the ignition console?",
      answer: ["EMBER"],
      success: "Lantern Market glows back to life. A signal races toward the river.",
      clues: [
        "The word begins with E and ends with R.",
        "The second letter appears twice in the word NIGHT? No — ignore NIGHT. The second letter is M.",
        "The center letter is B.",
        "The fourth letter is the same vowel that begins ECHO.",
        "The answer is something that can remain after a fire.",
        "Pattern from the ledger: E · M · B · E · R."
      ]
    },
    {
      name: "River Stage",
      title: "Restore the signal rhythm",
      story: "The floating stage can relay power across the river, but its emergency transmitter is listening for the festival’s missing call sign.",
      prompt: "Your clues point to one five-letter call sign. Enter it to restore the river relay.",
      answer: ["RIVER"],
      success: "The river relay answers. Blue-white current runs beneath the bridge.",
      clues: [
        "The call sign is also the thing directly beside the floating stage.",
        "It begins with R.",
        "Its middle letter is V.",
        "It ends with ER.",
        "The pattern is 5 letters: _ I _ E _.",
        "The full pattern is R I V E R."
      ]
    },
    {
      name: "Clocktower Lane",
      title: "Reset the frozen hour",
      story: "The clocktower stopped at the exact moment the blackout began. Its mechanical backup will only release when the original failure time is entered.",
      prompt: "What time did the blackout begin? Enter it as H:MM.",
      answer: ["11:42", "1142", "11 42"],
      success: "The clock hands move again, and the lane’s lanterns ignite one by one.",
      clues: [
        "The hour is eleven.",
        "The minute value is greater than 40 but less than 45.",
        "The minute digits add up to 6.",
        "The second minute digit is 2.",
        "The first minute digit is double the second.",
        "The frozen display read 11:42 PM."
      ]
    },
    {
      name: "Old Station",
      title: "Unlock the relay cabinet",
      story: "A brass relay cabinet blocks the final power route. Four numbered switches must be entered in the order hidden across old departure records.",
      prompt: "Enter the four-digit relay sequence.",
      answer: ["2314", "2 3 1 4"],
      success: "The cabinet snaps open. The final circuit to Beacon Hill is ready.",
      clues: [
        "The first digit is 2.",
        "The second digit is one greater than the first.",
        "The third digit is the smallest positive whole number.",
        "The final digit is twice the first.",
        "No digit repeats.",
        "The sequence is 2 → 3 → 1 → 4."
      ]
    },
    {
      name: "Beacon Hill",
      title: "Bring back the final light",
      story: "At the hilltop, the master beacon waits in darkness. Its final lock asks for the one thing the entire rescue has been trying to restore.",
      prompt: "Speak the final five-letter word into the beacon console.",
      answer: ["LIGHT"],
      success: "The beacon erupts across the skyline. The festival is saved.",
      clues: [
        "The word begins with L.",
        "The second letter is I.",
        "The middle letter is G.",
        "The final two letters are H and T.",
        "It is the opposite of darkness.",
        "The answer is LIGHT."
      ]
    }
  ]
};
