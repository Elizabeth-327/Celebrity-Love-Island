import './App.css'
import TypingText from './components/TypingText'

function App() {
  return (
    <div className="intro-screen">
      <h1>
        <TypingText text="Celebrity Love Island 🌴" speed={80} />
      </h1>
    </div>
  )
}

export default App
