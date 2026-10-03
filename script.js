const sentence = "the quick brown fox";
const textbox = document.getElementById("text");

for (let i = 0; i < sentence.length; i++) {

    const letter = document.createElement("span");
    letter.textContent = sentence[i];
    textbox.appendChild(letter);
}